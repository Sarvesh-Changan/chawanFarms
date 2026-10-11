/**
 * Pure policy helpers for Coupon eligibility, discount calculation, and code generation.
 * No database or framework dependencies.
 */

import { randomBytes } from "node:crypto";

/**
 * 32-character unambiguous alphabet (excludes 0, O, 1, I, L)
 * Power of 2 (2^5 = 32), enabling perfectly unbiased rejection-free bit masking.
 */
export const UNAMBIGUOUS_COUPON_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates a crypto-random, non-guessable coupon code of specified length (default: 12).
 * Uses bit masking over a power-of-2 alphabet, ensuring 0% modulo bias.
 */
export function generateCouponCode(length = 12): string {
  const targetLength = Math.max(12, length);
  const bytes = randomBytes(targetLength);
  let code = "";

  for (let i = 0; i < targetLength; i += 1) {
    const byte = bytes.at(i) ?? 0;
    // 32 chars => 5 bits mask (0b00011111 = 31)
    const index = byte & 31;
    code += UNAMBIGUOUS_COUPON_ALPHABET.charAt(index);
  }

  return code;
}

export type CouponRecord = {
  id: string;
  code: string;
  userId: string;
  tierId: string;
  status: "ACTIVE" | "REDEEMED" | "EXPIRED" | "REVOKED";
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number;
  maxDiscountPaise: number | null;
  minBookingPaise: number | null;
  pointsSpent: number;
  issuedAt: Date | string;
  expiresAt: Date | string;
};

export type TierEligibilityRules = {
  allPackages: boolean;
  allAccommodation: boolean;
  eligiblePackageIds?: readonly string[];
  eligibleAccommodationIds?: readonly string[];
};

export type CouponValidationContext = {
  userId: string;
  subtotalPaise: number;
  packageId?: string | null;
  accommodationId?: string | null;
  hasOfferApplied?: boolean;
  allowCombineWithOffers?: boolean;
  now?: Date;
};

export type CouponEligibilityResult =
  | { eligible: true; discountPaise: number }
  | {
      eligible: false;
      code:
        | "WRONG_OWNER"
        | "NOT_ACTIVE"
        | "EXPIRED"
        | "BELOW_MIN_SUBTOTAL"
        | "INELIGIBLE_PACKAGE"
        | "INELIGIBLE_ACCOMMODATION"
        | "OFFER_COMBINATION_DISALLOWED";
      publicReason: string;
    };

/**
 * Generic user-facing rejection message to prevent code enumeration and details leakage.
 */
export const GENERIC_COUPON_ERROR_MESSAGE = "The coupon code is invalid or unavailable.";

export function evaluateCouponEligibility(
  coupon: CouponRecord,
  tier: TierEligibilityRules,
  context: CouponValidationContext,
): CouponEligibilityResult {
  const now = context.now ?? new Date();
  const expiresAt = new Date(coupon.expiresAt);

  if (coupon.userId !== context.userId) {
    return {
      eligible: false,
      code: "WRONG_OWNER",
      publicReason: GENERIC_COUPON_ERROR_MESSAGE,
    };
  }

  if (coupon.status !== "ACTIVE") {
    return {
      eligible: false,
      code: "NOT_ACTIVE",
      publicReason: GENERIC_COUPON_ERROR_MESSAGE,
    };
  }

  if (expiresAt.getTime() <= now.getTime()) {
    return {
      eligible: false,
      code: "EXPIRED",
      publicReason: GENERIC_COUPON_ERROR_MESSAGE,
    };
  }

  if (context.hasOfferApplied && !context.allowCombineWithOffers) {
    return {
      eligible: false,
      code: "OFFER_COMBINATION_DISALLOWED",
      publicReason: GENERIC_COUPON_ERROR_MESSAGE,
    };
  }

  if (coupon.minBookingPaise !== null && context.subtotalPaise < coupon.minBookingPaise) {
    return {
      eligible: false,
      code: "BELOW_MIN_SUBTOTAL",
      publicReason: GENERIC_COUPON_ERROR_MESSAGE,
    };
  }

  if (!tier.allPackages && context.packageId) {
    const allowed = tier.eligiblePackageIds ?? [];
    if (!allowed.includes(context.packageId)) {
      return {
        eligible: false,
        code: "INELIGIBLE_PACKAGE",
        publicReason: GENERIC_COUPON_ERROR_MESSAGE,
      };
    }
  }

  if (!tier.allAccommodation && context.accommodationId) {
    const allowed = tier.eligibleAccommodationIds ?? [];
    if (!allowed.includes(context.accommodationId)) {
      return {
        eligible: false,
        code: "INELIGIBLE_ACCOMMODATION",
        publicReason: GENERIC_COUPON_ERROR_MESSAGE,
      };
    }
  }

  const discountPaise = computeCouponDiscountPaise(coupon, context.subtotalPaise);

  return { eligible: true, discountPaise };
}

/**
 * Calculates discount in integer paise.
 * Subtotal is strictly upper-bounded (discount never exceeds subtotal).
 */
export function computeCouponDiscountPaise(
  coupon: Pick<CouponRecord, "discountType" | "discountValue" | "maxDiscountPaise">,
  subtotalPaise: number,
): number {
  if (subtotalPaise <= 0) return 0;

  let discount = 0;

  if (coupon.discountType === "FIXED") {
    discount = Math.min(coupon.discountValue, subtotalPaise);
  } else if (coupon.discountType === "PERCENTAGE") {
    // Round half-up to integer paise: (subtotal * percent + 50) / 100
    discount = Math.floor((subtotalPaise * coupon.discountValue + 50) / 100);
  }

  if (coupon.maxDiscountPaise !== null && coupon.maxDiscountPaise > 0) {
    discount = Math.min(discount, coupon.maxDiscountPaise);
  }

  return Math.max(0, Math.min(discount, subtotalPaise));
}
