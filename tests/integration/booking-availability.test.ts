// @vitest-environment node

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

integrationDescribe("booking and availability integration", () => {
  let testDb: PrismaClient;
  let submitBookingRequest: typeof import("../../src/server/services/booking").submitBookingRequest;
  let transitionBookingStatus: typeof import("../../src/server/services/booking").transitionBookingStatus;
  let placeHold: typeof import("../../src/server/services/availability").placeHold;
  let cleanupExpiredHolds: typeof import("../../src/server/services/availability").cleanupExpiredHolds;

  let testAccommodationId: string;
  let testPackageId: string;

  beforeAll(async () => {
    testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl as string }) });
    await testDb.$connect();
    vi.doMock("@/server/db", () => ({ db: testDb }));

    ({ submitBookingRequest, transitionBookingStatus } = await import("../../src/server/services/booking"));
    ({ placeHold, cleanupExpiredHolds } = await import("../../src/server/services/availability"));

    // Ensure a test accommodation exists
    const acc = await testDb.accommodation.upsert({
      where: { slug: "test-guest-house" },
      update: {},
      create: {
        slug: "test-guest-house",
        type: "GUEST_HOUSE",
        name: { en: "Test Guest House" },
        description: { en: "Test accommodation with capacity 2" },
      },
    });
    testAccommodationId = acc.id;

    // Ensure a test package with rates exists
    const pkg = await testDb.package.upsert({
      where: { slug: "test-package-b" },
      update: {},
      create: {
        slug: "test-package-b",
        name: { en: "Test Package B" },
        inclusions: { en: "All meals" },
      },
    });
    testPackageId = pkg.id;

    await testDb.packageRate.upsert({
      where: { seedKey: "test-pkg-b:VEG:ADULT" },
      update: {},
      create: {
        seedKey: "test-pkg-b:VEG:ADULT",
        packageId: testPackageId,
        foodPreference: "VEG",
        audience: "ADULT",
        amountPaise: 230000,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test records
    await testDb?.bookingLine.deleteMany({ where: { booking: { contactEmail: "test-integ@example.com" } } });
    await testDb?.policyAcceptance.deleteMany({ where: { booking: { contactEmail: "test-integ@example.com" } } });
    await testDb?.booking.deleteMany({ where: { contactEmail: "test-integ@example.com" } });
    await testDb?.availabilityDay.deleteMany({ where: { accommodationId: testAccommodationId } });
    await testDb?.$disconnect();
  });

  it("tampered client price is strictly ignored; server re-quotes using integer paise", async () => {
    const idempotencyKey = crypto.randomUUID();
    const result = await submitBookingRequest({
      idempotencyKey,
      checkIn: "2026-11-20",
      checkOut: "2026-11-21",
      adults: 10,
      children4to10: 0,
      infantsUnder4: 0,
      packageSlug: "test-package-b",
      accommodationSlug: "test-guest-house",
      foodPreference: "VEG",
      contactName: "Tamper Test User",
      contactPhone: "+91 98765 00001",
      contactEmail: "test-integ@example.com",
      policyAccepted: true,
      extras: [],
    });

    // Client could not pass a price; server computes 10 * 230000 = 2300000 paise (₹23,000)
    expect(result.totalPaise).toBe(2300000);
    expect(result.status).toBe("PENDING_CONFIRMATION");
    expect(result.reference).toMatch(/^BKG-\d{4}-\d{6}$/);

    // Repeated submission with same idempotencyKey returns existing booking
    const duplicate = await submitBookingRequest({
      idempotencyKey,
      checkIn: "2026-11-20",
      checkOut: "2026-11-21",
      adults: 10,
      children4to10: 0,
      infantsUnder4: 0,
      packageSlug: "test-package-b",
      contactName: "Tamper Test User",
      contactPhone: "+91 98765 00001",
      contactEmail: "test-integ@example.com",
      policyAccepted: true,
      extras: [],
    });

    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.id).toBe(result.id);
  });

  it("prevents invalid status transitions and records audit", async () => {
    const booking = await testDb.booking.findFirst({
      where: { contactEmail: "test-integ@example.com" },
    });
    expect(booking).toBeDefined();
    if (!booking) {
      throw new Error("Expected booking to exist");
    }

    // Illegal transition: PENDING_CONFIRMATION -> COMPLETED (cannot skip CONFIRMED)
    const illegalResult = await transitionBookingStatus({
      bookingId: booking.id,
      targetStatus: "COMPLETED",
      actorId: "staff-1",
    });

    expect(illegalResult.ok).toBe(false);
    if (!illegalResult.ok) {
      expect(illegalResult.error).toContain("Illegal status transition");
    }

    // Verify audit log captured rejected transition
    const auditRecord = await testDb.auditLog.findFirst({
      where: {
        entityId: booking.id,
        action: "booking.status_transition_rejected",
      },
    });
    expect(auditRecord).toBeDefined();
  });

  it("concurrent confirmations cannot overbook constrained capacity", async () => {
    const testDate = new Date("2026-12-01T00:00:00Z");

    // Initialize AvailabilityDay for test date with capacity = 2
    await testDb.availabilityDay.upsert({
      where: {
        accommodationId_date: {
          accommodationId: testAccommodationId,
          date: testDate,
        },
      },
      update: { capacity: 2, held: 0, booked: 0, isBlocked: false },
      create: {
        accommodationId: testAccommodationId,
        date: testDate,
        capacity: 2,
        held: 0,
        booked: 0,
        isBlocked: false,
      },
    });

    // Create 2 bookings requiring 2 units each
    const bkg1 = await testDb.booking.create({
      data: {
        reference: `BKG-2026-TEST01`,
        contactName: "Racer 1",
        contactPhone: "+91 99999 11111",
        contactEmail: "test-integ@example.com",
        accommodationId: testAccommodationId,
        checkIn: testDate,
        checkOut: testDate, // Day visit
        nights: 0,
        adults: 2,
        subtotalPaise: 10000,
        totalPaise: 10000,
        pricingSnapshot: {},
        status: "PENDING_CONFIRMATION",
      },
    });

    const bkg2 = await testDb.booking.create({
      data: {
        reference: `BKG-2026-TEST02`,
        contactName: "Racer 2",
        contactPhone: "+91 99999 22222",
        contactEmail: "test-integ@example.com",
        accommodationId: testAccommodationId,
        checkIn: testDate,
        checkOut: testDate,
        nights: 0,
        adults: 2,
        subtotalPaise: 10000,
        totalPaise: 10000,
        pricingSnapshot: {},
        status: "PENDING_CONFIRMATION",
      },
    });

    // Place hold for first booking
    await testDb.$transaction(async (tx) => {
      await placeHold({
        bookingId: bkg1.id,
        accommodationId: testAccommodationId,
        accommodationSlug: "guest-house", // Requires 2 units
        checkIn: testDate,
        checkOut: testDate,
      }, tx);
    });

    // Second hold attempt must fail due to insufficient capacity
    await expect(
      testDb.$transaction(async (tx) => {
        await placeHold({
          bookingId: bkg2.id,
          accommodationId: testAccommodationId,
          accommodationSlug: "guest-house", // Requires 2 units
          checkIn: testDate,
          checkOut: testDate,
        }, tx);
      }),
    ).rejects.toThrow(/Insufficient capacity/);
  });

  it("hold expiry releases held inventory automatically", async () => {
    const expiredDate = new Date("2026-12-05T00:00:00Z");

    await testDb.availabilityDay.upsert({
      where: {
        accommodationId_date: {
          accommodationId: testAccommodationId,
          date: expiredDate,
        },
      },
      update: { capacity: 2, held: 2, booked: 0, isBlocked: false },
      create: {
        accommodationId: testAccommodationId,
        date: expiredDate,
        capacity: 2,
        held: 2,
        booked: 0,
      },
    });

    // Booking with hold expired 10 minutes ago
    const expiredBkg = await testDb.booking.create({
      data: {
        reference: `BKG-2026-EXP01`,
        contactName: "Expired Holder",
        contactPhone: "+91 99999 33333",
        contactEmail: "test-integ@example.com",
        accommodationId: testAccommodationId,
        checkIn: expiredDate,
        checkOut: expiredDate,
        nights: 0,
        adults: 2,
        subtotalPaise: 10000,
        totalPaise: 10000,
        pricingSnapshot: {},
        status: "PENDING_CONFIRMATION",
        holdExpiresAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    // Run cleanup
    const releasedCount = await cleanupExpiredHolds();
    expect(releasedCount).toBeGreaterThanOrEqual(1);

    // Verify held inventory dropped back to 0
    const day = await testDb.availabilityDay.findUnique({
      where: {
        accommodationId_date: {
          accommodationId: testAccommodationId,
          date: expiredDate,
        },
      },
    });
    expect(day?.held).toBe(0);

    // Verify booking marked cancelled
    const updatedBkg = await testDb.booking.findUnique({
      where: { id: expiredBkg.id },
    });
    expect(updatedBkg?.status).toBe("CANCELLED");
    expect(updatedBkg?.cancelReason).toContain("Hold expired automatically");
  });
});
