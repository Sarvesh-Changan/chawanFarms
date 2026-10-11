// @vitest-environment node

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";
import type { RewardTierSnapshot } from "../../src/server/policies/rewardCaps";

loadEnv({ path: ".env.local" });
loadEnv();

let confirmCouponRedemption: typeof import("../../src/server/services/coupons").confirmCouponRedemption;
let issueCoupon: typeof import("../../src/server/services/coupons").issueCoupon;
let releaseCouponOnCancellation: typeof import("../../src/server/services/coupons").releaseCouponOnCancellation;
let validateCoupon: typeof import("../../src/server/services/coupons").validateCoupon;

let adjustPoints: typeof import("../../src/server/services/rewards").adjustPoints;
let approveAdjustment: typeof import("../../src/server/services/rewards").approveAdjustment;
let redeemPoints: typeof import("../../src/server/services/rewards").redeemPoints;
let reverseEntry: typeof import("../../src/server/services/rewards").reverseEntry;

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

integrationDescribe("reward engine concurrency and transactional integrity", () => {
  let testDb: PrismaClient | undefined;
  let testDb2: PrismaClient | undefined;

  function database(): PrismaClient {
    if (!testDb) {
      throw new Error("TEST_DATABASE_URL is required for database integration tests");
    }
    return testDb;
  }

  function database2(): PrismaClient {
    if (!testDb2) {
      throw new Error("TEST_DATABASE_URL is required for database integration tests");
    }
    return testDb2;
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) return;

    process.env.DATABASE_URL = testDatabaseUrl;

    const couponsService = await import("../../src/server/services/coupons");
    confirmCouponRedemption = couponsService.confirmCouponRedemption;
    issueCoupon = couponsService.issueCoupon;
    releaseCouponOnCancellation = couponsService.releaseCouponOnCancellation;
    validateCoupon = couponsService.validateCoupon;

    const rewardsService = await import("../../src/server/services/rewards");
    adjustPoints = rewardsService.adjustPoints;
    approveAdjustment = rewardsService.approveAdjustment;
    redeemPoints = rewardsService.redeemPoints;
    reverseEntry = rewardsService.reverseEntry;

    testDb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });
    testDb2 = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });

    await testDb.$connect();
    await testDb2.$connect();

    // Clean test tables
    await testDb.$executeRaw`
      TRUNCATE TABLE "PointsAdjustmentRequest", "PointsLedger", "CouponRedemption", "Coupon",
        "BookingLine", "Booking", "RewardTierAccommodation", "RewardTierPackage",
        "RewardTier", "RewardRule", "CustomerProfile", "LeadEvent", "Lead", "user" CASCADE
    `;
  });

  afterAll(async () => {
    if (testDb) await testDb.$disconnect();
    if (testDb2) await testDb2.$disconnect();
  });

  async function createTestRuleWithTiers(db: PrismaClient) {
    return db.rewardRule.create({
      data: {
        version: 1,
        isActive: true,
        pointsPerApprovedVideo: 100,
        maxPointsPerCustomer: 500,
        maxSubmissionsPerPeriod: 2,
        periodDays: 30,
        pointExpiryDays: 365,
        minPointsToRedeem: 100,
        couponValidityDays: 90,
        allowCombineWithOffers: false,
        allowMultipleCouponsPerBooking: false,
        manualAdjustMaxPoints: 50,
        manualAdjustApprovalThreshold: 200,
        tiers: {
          create: [
            {
              name: "Tier 1",
              pointsCost: 100,
              discountType: "PERCENTAGE",
              discountValue: 10,
              maxDiscountPaise: 50000,
              minBookingPaise: 500000,
              allPackages: true,
              allAccommodation: true,
            },
            {
              name: "Tier 2",
              pointsCost: 250,
              discountType: "FIXED",
              discountValue: 100000,
              maxDiscountPaise: 100000,
              minBookingPaise: 1000000,
              allPackages: true,
              allAccommodation: true,
            },
          ],
        },
      },
      include: { tiers: true },
    });
  }

  async function createCustomerWithPoints(db: PrismaClient, points: number, emailPrefix = "cust") {
    const user = await db.user.create({
      data: {
        email: `${emailPrefix}-${randomUUID()}@example.com`,
        name: "Test Customer",
        type: "CUSTOMER",
      },
    });

    const profile = await db.customerProfile.create({
      data: {
        userId: user.id,
        referralCode: `REF-${user.id.slice(0, 8).toUpperCase()}`,
        pointsBalance: points,
      },
    });

    if (points > 0) {
      await db.pointsLedger.create({
        data: {
          userId: user.id,
          type: "EARN",
          points,
          balanceAfter: points,
          idempotencyKey: `init-earn-${randomUUID()}`,
        },
      });
    }

    return { user, profile };
  }

  async function createStaffUser(db: PrismaClient, emailPrefix = "staff") {
    return db.user.create({
      data: {
        email: `${emailPrefix}-${randomUUID()}@example.com`,
        name: "Staff User",
        type: "STAFF",
      },
    });
  }

  it("1. prevents concurrent double redemption (exactly one succeeds)", async () => {
    const db1 = database();
    const db2 = database2();
    const rule = await createTestRuleWithTiers(db1);
    const tier = rule.tiers.find((t) => t.pointsCost === 100);
    expect(tier).toBeDefined();
    if (!tier) return;

    // Customer has 100 points — enough for only ONE redemption
    const { user } = await createCustomerWithPoints(db1, 100, "double-redeem");

    const [res1, res2] = await Promise.all([
      redeemPoints({ userId: user.id, tierId: tier.id, clientKey: `k1-${randomUUID()}` }, db1),
      redeemPoints({ userId: user.id, tierId: tier.id, clientKey: `k2-${randomUUID()}` }, db2),
    ]);

    const successes = [res1, res2].filter((r) => r.ok);
    const failures = [res1, res2].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Profile points balance must be exactly 0
    const profile = await db1.customerProfile.findUnique({ where: { userId: user.id } });
    expect(profile?.pointsBalance).toBe(0);

    // Only one coupon created
    const coupons = await db1.coupon.findMany({ where: { userId: user.id } });
    expect(coupons).toHaveLength(1);
  });

  it("2. prevents concurrent double approval of an adjustment request (exactly one succeeds)", async () => {
    const db1 = database();
    const db2 = database2();
    const { user } = await createCustomerWithPoints(db1, 0, "adjust-test");
    const requester = await createStaffUser(db1, "requester");
    const approver = await createStaffUser(db1, "approver");

    // Create adjustment request requiring approval (points: 300 > threshold 200)
    const request = await adjustPoints({
      userId: user.id,
      points: 300,
      reason: "High adjustment test",
      actorId: requester.id,
      isSuperAdmin: false,
      clientKey: `adj-req-${randomUUID()}`,
    }, db1);

    expect(request.ok).toBe(true);
    if (!request.ok) return;
    expect(request.data.status).toBe("PENDING_APPROVAL");
    if (request.data.status !== "PENDING_APPROVAL") return;

    const requestId = request.data.requestId;

    // Two concurrent approve calls with two different db clients
    const [approve1, approve2] = await Promise.all([
      approveAdjustment({ requestId, decidedById: approver.id }, db1),
      approveAdjustment({ requestId, decidedById: approver.id }, db2),
    ]);

    const successes = [approve1, approve2].filter((r) => r.ok);
    const failures = [approve1, approve2].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Request status must be APPROVED
    const finalRequest = await db1.pointsAdjustmentRequest.findUnique({ where: { id: requestId } });
    expect(finalRequest?.status).toBe("APPROVED");
    expect(finalRequest?.decidedById).toBe(approver.id);

    // Exactly one ADJUST ledger row created
    const ledgerRows = await db1.pointsLedger.findMany({
      where: { userId: user.id, type: "ADJUST" },
    });
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]?.points).toBe(300);

    // Profile pointsBalance must be 300
    const profile = await db1.customerProfile.findUnique({ where: { userId: user.id } });
    expect(profile?.pointsBalance).toBe(300);
  });

  it("3. prevents confirming the same coupon on two bookings concurrently (exactly one succeeds)", async () => {
    const db1 = database();
    const db2 = database2();
    const rule = await createTestRuleWithTiers(db1);
    const tier = rule.tiers[0] as unknown as RewardTierSnapshot;
    const { user } = await createCustomerWithPoints(db1, 200, "coupon-race");

    // Issue coupon
    const coupon = await issueCoupon(db1, {
      userId: user.id,
      tier,
      validityDays: 90,
    });

    // Create lead
    const lead = await db1.lead.create({
      data: { name: "Test Lead", phone: "+919876543210", email: "lead@example.com" },
    });

    // Create two bookings for same user
    const booking1 = await db1.booking.create({
      data: {
        reference: `BKG-TEST-1-${randomUUID().slice(0, 8)}`,
        contactName: "Test Customer",
        contactPhone: "+919876543210",
        leadId: lead.id,
        userId: user.id,
        status: "PENDING_CONFIRMATION",
        subtotalPaise: 600000,
        discountPaise: 50000,
        taxPaise: 0,
        totalPaise: 550000,
        nights: 2,
        adults: 2,
        checkIn: new Date(Date.now() + 86400000 * 5),
        checkOut: new Date(Date.now() + 86400000 * 7),
        couponId: coupon.id,
        pricingSnapshot: {},
      },
    });

    const booking2 = await db1.booking.create({
      data: {
        reference: `BKG-TEST-2-${randomUUID().slice(0, 8)}`,
        contactName: "Test Customer",
        contactPhone: "+919876543210",
        leadId: lead.id,
        userId: user.id,
        status: "PENDING_CONFIRMATION",
        subtotalPaise: 600000,
        discountPaise: 50000,
        taxPaise: 0,
        totalPaise: 550000,
        nights: 2,
        adults: 2,
        checkIn: new Date(Date.now() + 86400000 * 5),
        checkOut: new Date(Date.now() + 86400000 * 7),
        couponId: coupon.id,
        pricingSnapshot: {},
      },
    });

    // Concurrently confirm redemption
    const [res1, res2] = await Promise.all([
      db1.$transaction(async (tx) => {
        return confirmCouponRedemption(tx, {
          bookingId: booking1.id,
          couponId: coupon.id,
          discountPaise: 50000,
          userId: user.id,
          subtotalPaise: 600000,
        });
      }),
      db2.$transaction(async (tx) => {
        return confirmCouponRedemption(tx, {
          bookingId: booking2.id,
          couponId: coupon.id,
          discountPaise: 50000,
          userId: user.id,
          subtotalPaise: 600000,
        });
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.ok);
    const failures = [res1, res2].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Coupon status must be REDEEMED
    const updatedCoupon = await db1.coupon.findUnique({ where: { id: coupon.id } });
    expect(updatedCoupon?.status).toBe("REDEEMED");

    // Exactly one active CouponRedemption row
    const redemptions = await db1.couponRedemption.findMany({ where: { couponId: coupon.id } });
    expect(redemptions).toHaveLength(1);
  });

  it("4. blocks PointsLedger UPDATE and DELETE via database trigger", async () => {
    const db = database();
    const { user } = await createCustomerWithPoints(db, 50, "trigger-test");

    const ledger = await db.pointsLedger.findFirst({ where: { userId: user.id } });
    expect(ledger).toBeTruthy();
    if (!ledger) return;

    // UPDATE must fail due to points_ledger_immutable trigger
    await expect(
      db.pointsLedger.update({
        where: { id: ledger.id },
        data: { points: 999 },
      }),
    ).rejects.toThrow();

    // DELETE must fail due to points_ledger_immutable trigger
    await expect(
      db.pointsLedger.delete({
        where: { id: ledger.id },
      }),
    ).rejects.toThrow();
  });

  it("5. restricts reversal to a single time per ledger entry (reversesEntryId uniqueness)", async () => {
    const db = database();
    const { user } = await createCustomerWithPoints(db, 100, "reverse-test");
    const staff = await createStaffUser(db, "rev-staff");

    const originalLedger = await db.pointsLedger.findFirst({ where: { userId: user.id } });
    expect(originalLedger).toBeTruthy();
    if (!originalLedger) return;

    // First reversal succeeds
    const rev1 = await reverseEntry({
      ledgerEntryId: originalLedger.id,
      reason: "Accidental earn entry",
      actorId: staff.id,
    }, db);

    expect(rev1.ok).toBe(true);

    // Second reversal must fail
    const rev2 = await reverseEntry({
      ledgerEntryId: originalLedger.id,
      reason: "Attempt second reversal",
      actorId: staff.id,
    }, db);

    expect(rev2.ok).toBe(false);
    if (!rev2.ok) {
      expect(rev2.error.code).toBe("CONFLICT");
    }

    // Profile balance must be 0 after 1 reversal
    const profile = await db.customerProfile.findUnique({ where: { userId: user.id } });
    expect(profile?.pointsBalance).toBe(0);
  });

  it("6. rejects second approver if same as requester", async () => {
    const db = database();
    const { user } = await createCustomerWithPoints(db, 0, "self-approve");
    const staff = await createStaffUser(db, "requester-approver");

    const request = await adjustPoints({
      userId: user.id,
      points: 300,
      reason: "Requires two eyes",
      actorId: staff.id,
      isSuperAdmin: false,
      clientKey: `adj-self-${randomUUID()}`,
    }, db);

    expect(request.ok).toBe(true);
    if (!request.ok || request.data.status !== "PENDING_APPROVAL") return;

    // Self-approval must be rejected
    const approveResult = await approveAdjustment({
      requestId: request.data.requestId,
      decidedById: staff.id,
    }, db);

    expect(approveResult.ok).toBe(false);
    if (!approveResult.ok) {
      expect(approveResult.error.code).toBe("FORBIDDEN");
    }
  });

  it("7. rejects coupon validation for wrong user, subtotal below minimum, and expired coupon", async () => {
    const db = database();
    const rule = await createTestRuleWithTiers(db);
    const tier = rule.tiers[0] as unknown as RewardTierSnapshot; // minBookingPaise: 500000
    const { user: userA } = await createCustomerWithPoints(db, 200, "user-a");
    const { user: userB } = await createCustomerWithPoints(db, 200, "user-b");

    const coupon = await issueCoupon(db, {
      userId: userA.id,
      tier,
      validityDays: 90,
    });

    // 1. Wrong user
    const resWrongUser = await validateCoupon(coupon.code, {
      userId: userB.id,
      subtotalPaise: 600000,
    }, db);
    expect(resWrongUser.ok).toBe(false);

    // 2. Subtotal below minimum (400000 < 500000)
    const resLowSubtotal = await validateCoupon(coupon.code, {
      userId: userA.id,
      subtotalPaise: 400000,
    }, db);
    expect(resLowSubtotal.ok).toBe(false);

    // 3. Expired coupon
    await db.coupon.update({
      where: { id: coupon.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const resExpired = await validateCoupon(coupon.code, {
      userId: userA.id,
      subtotalPaise: 600000,
    }, db);
    expect(resExpired.ok).toBe(false);
  });

  it("8. cancellation restores unexpired coupon before check-in, but NOT after NO_SHOW", async () => {
    const db = database();
    const rule = await createTestRuleWithTiers(db);
    const tier = rule.tiers[0] as unknown as RewardTierSnapshot;
    const { user } = await createCustomerWithPoints(db, 200, "restore-test");

    const coupon = await issueCoupon(db, {
      userId: user.id,
      tier,
      validityDays: 90,
    });

    const lead = await db.lead.create({
      data: { name: "Lead Rest", phone: "+919876543211" },
    });

    const booking = await db.booking.create({
      data: {
        reference: `BKG-CAN-${randomUUID().slice(0, 8)}`,
        contactName: "Test Customer",
        contactPhone: "+919876543210",
        leadId: lead.id,
        userId: user.id,
        status: "PENDING_CONFIRMATION",
        subtotalPaise: 600000,
        discountPaise: 50000,
        taxPaise: 0,
        totalPaise: 550000,
        nights: 2,
        adults: 2,
        checkIn: new Date(Date.now() + 86400000 * 5),
        checkOut: new Date(Date.now() + 86400000 * 7),
        couponId: coupon.id,
        pricingSnapshot: {},
      },
    });

    // Redeem coupon on booking
    await db.$transaction(async (tx) => {
      await confirmCouponRedemption(tx, {
        bookingId: booking.id,
        couponId: coupon.id,
        discountPaise: 50000,
        userId: user.id,
        subtotalPaise: 600000,
      });
    });

    // Check redeemed
    let couponRecord = await db.coupon.findUnique({ where: { id: coupon.id } });
    expect(couponRecord?.status).toBe("REDEEMED");

    // Case A: Cancellation before check-in restores coupon to ACTIVE
    await db.$transaction(async (tx) => {
      await releaseCouponOnCancellation(tx, {
        bookingId: booking.id,
        cancellationReason: "Guest cancelled early",
        isBeforeCheckIn: true,
        bookingStatus: "CANCELLED",
      });
    });

    couponRecord = await db.coupon.findUnique({ where: { id: coupon.id } });
    expect(couponRecord?.status).toBe("ACTIVE");

    // Check redemption history was retained
    const redemptionRow = await db.couponRedemption.findUnique({ where: { bookingId: booking.id } });
    expect(redemptionRow?.releasedAt).toBeTruthy();
    expect(redemptionRow?.releaseReason).toBe("Guest cancelled early");

    // Re-redeem on a second booking to test NO_SHOW case
    const booking2 = await db.booking.create({
      data: {
        reference: `BKG-NS-${randomUUID().slice(0, 8)}`,
        contactName: "Test Customer",
        contactPhone: "+919876543210",
        leadId: lead.id,
        userId: user.id,
        status: "PENDING_CONFIRMATION",
        subtotalPaise: 600000,
        discountPaise: 50000,
        taxPaise: 0,
        totalPaise: 550000,
        nights: 2,
        adults: 2,
        checkIn: new Date(Date.now() + 86400000 * 5),
        checkOut: new Date(Date.now() + 86400000 * 7),
        couponId: coupon.id,
        pricingSnapshot: {},
      },
    });

    await db.$transaction(async (tx) => {
      await confirmCouponRedemption(tx, {
        bookingId: booking2.id,
        couponId: coupon.id,
        discountPaise: 50000,
        userId: user.id,
        subtotalPaise: 600000,
      });
    });

    // Case B: NO_SHOW does NOT restore coupon to ACTIVE
    await db.$transaction(async (tx) => {
      await releaseCouponOnCancellation(tx, {
        bookingId: booking2.id,
        cancellationReason: "Guest did not show up",
        isBeforeCheckIn: false,
        bookingStatus: "NO_SHOW",
      });
    });

    couponRecord = await db.coupon.findUnique({ where: { id: coupon.id } });
    expect(couponRecord?.status).toBe("REDEEMED"); // Not restored!
  });
});
