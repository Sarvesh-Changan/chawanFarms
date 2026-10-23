import "server-only";

/**
 * COUPON SERVICE — Issue, validate, redeem, and release lifecycle.
 *
 * LOCK ORDER (Must be strictly followed to prevent deadlocks):
 * 1. CustomerProfile
 * 2. Coupon
 * 3. Booking
 */

import { Prisma, PrismaClient, type Coupon } from "@/generated/prisma/client";
import { err, ok, type Result } from "@/lib/result";
import { db } from "@/server/db";
import {
  evaluateCouponEligibility,
  generateCouponCode,
  GENERIC_COUPON_ERROR_MESSAGE,
  type CouponRecord,
  type TierEligibilityRules,
} from "@/server/policies/couponEligibility";
import type { ValidatedCoupon } from "@/server/policies/pricing";
import type { RewardTierSnapshot } from "@/server/policies/rewardCaps";

export type CouponServiceError =
  | "COUPON_INVALID_OR_UNAVAILABLE"
  | "COUPON_NOT_FOUND"
  | "BOOKING_NOT_FOUND"
  | "COUPON_ALREADY_REDEEMED"
  | "COUPON_EXPIRED"
  | "FEATURE_DISABLED";

/**
 * Issues a new coupon on points redemption.
 * Must be executed within a transaction where CustomerProfile is already locked.
 */
export async function issueCoupon(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    tier: RewardTierSnapshot;
    validityDays: number;
  },
): Promise<Coupon> {
  const code = generateCouponCode(12);
  const expiresAt = new Date(Date.now() + input.validityDays * 24 * 60 * 60 * 1000);

  return tx.coupon.create({
    data: {
      code,
      userId: input.userId,
      tierId: input.tier.id,
      status: "ACTIVE",
      discountType: input.tier.discountType,
      discountValue: input.tier.discountValue,
      maxDiscountPaise: input.tier.maxDiscountPaise,
      minBookingPaise: input.tier.minBookingPaise,
      pointsSpent: input.tier.pointsCost,
      expiresAt,
    },
  });
}

/**
 * Validates a coupon code against booking context.
 * Returns ONE generic error ("The coupon code is invalid or unavailable.")
 * to prevent brute-force code enumeration and information leakage.
 */
export async function validateCoupon(
  code: string,
  context: {
    userId: string;
    subtotalPaise: number;
    packageId?: string | null;
    accommodationId?: string | null;
    hasOfferApplied?: boolean;
    now?: Date;
  },
  tx: Prisma.TransactionClient = db,
): Promise<
  Result<{
    coupon: Coupon;
    discountPaise: number;
    pricingCoupon: ValidatedCoupon;
  }>
> {
  const normalizedCode = code.trim().toUpperCase();

  const coupon = await tx.coupon.findUnique({
    where: { code: normalizedCode },
    include: {
      tier: {
        include: {
          packages: true,
          accommodations: true,
        },
      },
    },
  });

  if (!coupon) {
    return err("NOT_FOUND", GENERIC_COUPON_ERROR_MESSAGE);
  }

  // Fetch active rule to check combination settings
  const activeRule = await tx.rewardRule.findFirst({
    where: { isActive: true },
    select: { allowCombineWithOffers: true },
  });

  const couponRecord: CouponRecord = {
    id: coupon.id,
    code: coupon.code,
    userId: coupon.userId,
    tierId: coupon.tierId,
    status: coupon.status,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountPaise: coupon.maxDiscountPaise,
    minBookingPaise: coupon.minBookingPaise,
    pointsSpent: coupon.pointsSpent,
    issuedAt: coupon.issuedAt,
    expiresAt: coupon.expiresAt,
  };

  const tierEligibility: TierEligibilityRules = {
    allPackages: coupon.tier.allPackages,
    allAccommodation: coupon.tier.allAccommodation,
    eligiblePackageIds: coupon.tier.packages.map((p) => p.packageId),
    eligibleAccommodationIds: coupon.tier.accommodations.map((a) => a.accommodationId),
  };

  const evaluation = evaluateCouponEligibility(couponRecord, tierEligibility, {
    userId: context.userId,
    subtotalPaise: context.subtotalPaise,
    packageId: context.packageId,
    accommodationId: context.accommodationId,
    hasOfferApplied: context.hasOfferApplied,
    allowCombineWithOffers: activeRule?.allowCombineWithOffers ?? false,
    now: context.now,
  });

  if (!evaluation.eligible) {
    return err("VALIDATION", GENERIC_COUPON_ERROR_MESSAGE);
  }

  const pricingCoupon: ValidatedCoupon = {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountPaise: coupon.maxDiscountPaise,
    minBookingPaise: coupon.minBookingPaise,
  };

  return ok({
    coupon,
    discountPaise: evaluation.discountPaise,
    pricingCoupon,
  });
}

/**
 * Confirms coupon redemption at booking confirmation.
 * Runs inside the confirmation transaction with lock order:
 * 1. CustomerProfile (if locked by caller)
 * 2. Coupon (locked FOR UPDATE)
 * 3. Booking (locked by caller)
 */
export async function confirmCouponRedemption(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    couponId: string;
    discountPaise: number;
    userId: string;
    subtotalPaise: number;
    packageId?: string | null;
    accommodationId?: string | null;
    hasOfferApplied?: boolean;
  },
): Promise<Result<{ redemptionId: string }>> {
  // 2. Lock Coupon row
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Coupon" WHERE id = ${input.couponId} FOR UPDATE`,
  );

  const coupon = await tx.coupon.findUnique({
    where: { id: input.couponId },
    include: {
      tier: {
        include: {
          packages: true,
          accommodations: true,
        },
      },
    },
  });

  if (!coupon) {
    return err("NOT_FOUND", "Coupon not found.");
  }

  if (coupon.status !== "ACTIVE") {
    return err("CONFLICT", "Coupon is no longer active.");
  }

  const now = new Date();
  if (coupon.expiresAt.getTime() <= now.getTime()) {
    return err("VALIDATION", "Coupon has expired.");
  }

  // Verify eligibility again in locked transaction
  const activeRule = await tx.rewardRule.findFirst({
    where: { isActive: true },
    select: { allowCombineWithOffers: true },
  });

  const couponRecord: CouponRecord = {
    id: coupon.id,
    code: coupon.code,
    userId: coupon.userId,
    tierId: coupon.tierId,
    status: coupon.status,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountPaise: coupon.maxDiscountPaise,
    minBookingPaise: coupon.minBookingPaise,
    pointsSpent: coupon.pointsSpent,
    issuedAt: coupon.issuedAt,
    expiresAt: coupon.expiresAt,
  };

  const tierEligibility: TierEligibilityRules = {
    allPackages: coupon.tier.allPackages,
    allAccommodation: coupon.tier.allAccommodation,
    eligiblePackageIds: coupon.tier.packages.map((p) => p.packageId),
    eligibleAccommodationIds: coupon.tier.accommodations.map((a) => a.accommodationId),
  };

  const evaluation = evaluateCouponEligibility(couponRecord, tierEligibility, {
    userId: input.userId,
    subtotalPaise: input.subtotalPaise,
    packageId: input.packageId,
    accommodationId: input.accommodationId,
    hasOfferApplied: input.hasOfferApplied,
    allowCombineWithOffers: activeRule?.allowCombineWithOffers ?? false,
    now,
  });

  if (!evaluation.eligible) {
    return err("VALIDATION", GENERIC_COUPON_ERROR_MESSAGE);
  }

  // Update coupon to REDEEMED
  await tx.coupon.update({
    where: { id: coupon.id },
    data: { status: "REDEEMED" },
  });

  // Create CouponRedemption row
  const redemption = await tx.couponRedemption.create({
    data: {
      couponId: coupon.id,
      bookingId: input.bookingId,
      discountPaise: input.discountPaise,
    },
  });

  return ok({ redemptionId: redemption.id });
}

/**
 * Releases coupon on booking cancellation or rejection.
 * Policy per client decision:
 * - Restore coupon to ACTIVE if its expiresAt is still in the future AND booking cancelled/rejected BEFORE check-in.
 * - Do NOT restore for NO_SHOW or COMPLETED.
 * - Never refund or reverse points on cancellation.
 * - If already expired, stays expired.
 * - Keeps redemption history: records releasedAt and releaseReason on the CouponRedemption row.
 */
export async function releaseCouponOnCancellation(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    cancellationReason: string;
    isBeforeCheckIn: boolean;
    bookingStatus: "CANCELLED" | "REJECTED" | "NO_SHOW" | "COMPLETED";
  },
): Promise<Result<{ released: boolean; restoredToActive: boolean }>> {
  const redemption = await tx.couponRedemption.findUnique({
    where: { bookingId: input.bookingId },
    include: { coupon: true },
  });

  if (!redemption || redemption.releasedAt !== null) {
    // If booking still has a couponId attached without redemption, clear it so the coupon can be reused
    await tx.booking.updateMany({
      where: { id: input.bookingId, couponId: { not: null } },
      data: { couponId: null },
    });
    return ok({ released: false, restoredToActive: false });
  }

  const now = new Date();
  const shouldRestore =
    input.isBeforeCheckIn &&
    input.bookingStatus !== "NO_SHOW" &&
    input.bookingStatus !== "COMPLETED" &&
    redemption.coupon.expiresAt.getTime() > now.getTime();

  // Mark redemption as released (retaining audit and history)
  await tx.couponRedemption.update({
    where: { id: redemption.id },
    data: {
      releasedAt: now,
      releaseReason: input.cancellationReason,
    },
  });

  if (shouldRestore) {
    await tx.coupon.update({
      where: { id: redemption.couponId },
      data: { status: "ACTIVE" },
    });
  }

  // Clear Booking.couponId so the coupon can be attached to a future booking without violating unique constraint
  await tx.booking.updateMany({
    where: { id: input.bookingId },
    data: { couponId: null },
  });

  return ok({ released: true, restoredToActive: shouldRestore });
}

/**
 * Revokes an ACTIVE coupon.
 * Invariants:
 * 1. Coupon exists and is currently ACTIVE.
 * 2. Coupon is NOT attached to an active or pending booking (Booking.couponId).
 * 3. No automatic points refund (staff can use manual adjustment if required).
 */
export async function revokeCouponService(
  input: {
    couponId: string;
    reason: string;
    actorId: string;
  },
  client: Prisma.TransactionClient | PrismaClient = db,
): Promise<Result<{ coupon: Coupon }>> {
  const execute = async (tx: Prisma.TransactionClient) => {
    const coupon = await tx.coupon.findUnique({
      where: { id: input.couponId },
    });
    if (!coupon) {
      return err("NOT_FOUND", "Coupon not found.");
    }
    if (coupon.status !== "ACTIVE") {
      return err(
        "CONFLICT",
        `Cannot revoke coupon with status ${coupon.status}. Only ACTIVE coupons can be revoked.`,
      );
    }

    const attachedBooking = await tx.booking.findFirst({
      where: {
        couponId: coupon.id,
        status: { in: ["ENQUIRY", "PENDING_CONFIRMATION"] },
        deletedAt: null,
      },
    });
    if (attachedBooking) {
      return err(
        "CONFLICT",
        "Cannot revoke coupon: it is currently attached to a pending booking.",
      );
    }

    const updated = await tx.coupon.update({
      where: { id: coupon.id },
      data: { status: "REVOKED" },
    });

    return ok({ coupon: updated });
  };

  if ("$transaction" in client && typeof client.$transaction === "function") {
    return client.$transaction(execute);
  }
  return execute(client as Prisma.TransactionClient);
}
