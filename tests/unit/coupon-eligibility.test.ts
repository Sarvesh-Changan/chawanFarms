import { describe, expect, it } from "vitest";

import {
  computeCouponDiscountPaise,
  evaluateCouponEligibility,
  generateCouponCode,
  GENERIC_COUPON_ERROR_MESSAGE,
  UNAMBIGUOUS_COUPON_ALPHABET,
  type CouponRecord,
  type TierEligibilityRules,
} from "../../src/server/policies/couponEligibility";

describe("generateCouponCode", () => {
  it("generates a 12-character code using only the unambiguous alphabet", () => {
    const code = generateCouponCode(12);
    expect(code).toHaveLength(12);
    for (const char of code) {
      expect(UNAMBIGUOUS_COUPON_ALPHABET).toContain(char);
    }
  });

  it("produces distinct random codes without collisions in a sample", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      codes.add(generateCouponCode(12));
    }
    expect(codes.size).toBe(100);
  });
});

describe("computeCouponDiscountPaise", () => {
  it("calculates percentage discount accurately in integer paise", () => {
    // 5% of ₹5,000 (500,000 paise) = 25,000 paise
    const discount = computeCouponDiscountPaise(
      { discountType: "PERCENTAGE", discountValue: 5, maxDiscountPaise: 50000 },
      500000,
    );
    expect(discount).toBe(25000);
  });

  it("caps discount at maxDiscountPaise", () => {
    // 10% of ₹15,000 (1,500,000 paise) = 150,000 paise, but max is 100,000 paise
    const discount = computeCouponDiscountPaise(
      { discountType: "PERCENTAGE", discountValue: 10, maxDiscountPaise: 100000 },
      1500000,
    );
    expect(discount).toBe(100000);
  });

  it("ensures discount never exceeds subtotal", () => {
    // ₹1,000 fixed discount on ₹800 subtotal
    const discount = computeCouponDiscountPaise(
      { discountType: "FIXED", discountValue: 100000, maxDiscountPaise: null },
      80000,
    );
    expect(discount).toBe(80000);
  });
});

describe("evaluateCouponEligibility", () => {
  const futureExpiry = new Date(Date.now() + 86400 * 1000 * 30);
  const pastExpiry = new Date(Date.now() - 86400 * 1000);

  const validCoupon: CouponRecord = {
    id: "coupon-1",
    code: "CFABCD234567",
    userId: "user-1",
    tierId: "tier-1",
    status: "ACTIVE",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxDiscountPaise: 100000,
    minBookingPaise: 500000,
    pointsSpent: 250,
    issuedAt: new Date(),
    expiresAt: futureExpiry,
  };

  const allEligibleTier: TierEligibilityRules = {
    allPackages: true,
    allAccommodation: true,
  };

  it("validates successfully for matching owner, active status, and subtotal met", () => {
    const result = evaluateCouponEligibility(validCoupon, allEligibleTier, {
      userId: "user-1",
      subtotalPaise: 600000,
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.discountPaise).toBe(60000);
    }
  });

  it("rejects coupon owned by a different user with generic error", () => {
    const result = evaluateCouponEligibility(validCoupon, allEligibleTier, {
      userId: "user-2",
      subtotalPaise: 600000,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe("WRONG_OWNER");
      expect(result.publicReason).toBe(GENERIC_COUPON_ERROR_MESSAGE);
    }
  });

  it("rejects redeemed or revoked coupon", () => {
    const redeemedCoupon: CouponRecord = { ...validCoupon, status: "REDEEMED" };
    const result = evaluateCouponEligibility(redeemedCoupon, allEligibleTier, {
      userId: "user-1",
      subtotalPaise: 600000,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe("NOT_ACTIVE");
      expect(result.publicReason).toBe(GENERIC_COUPON_ERROR_MESSAGE);
    }
  });

  it("rejects expired coupon", () => {
    const expiredCoupon: CouponRecord = { ...validCoupon, expiresAt: pastExpiry };
    const result = evaluateCouponEligibility(expiredCoupon, allEligibleTier, {
      userId: "user-1",
      subtotalPaise: 600000,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe("EXPIRED");
      expect(result.publicReason).toBe(GENERIC_COUPON_ERROR_MESSAGE);
    }
  });

  it("rejects booking below minimum booking value", () => {
    const result = evaluateCouponEligibility(validCoupon, allEligibleTier, {
      userId: "user-1",
      subtotalPaise: 400000, // below 500,000
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe("BELOW_MIN_SUBTOTAL");
      expect(result.publicReason).toBe(GENERIC_COUPON_ERROR_MESSAGE);
    }
  });

  it("rejects combination when booking has offer and rule forbids combination", () => {
    const result = evaluateCouponEligibility(validCoupon, allEligibleTier, {
      userId: "user-1",
      subtotalPaise: 600000,
      hasOfferApplied: true,
      allowCombineWithOffers: false,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe("OFFER_COMBINATION_DISALLOWED");
      expect(result.publicReason).toBe(GENERIC_COUPON_ERROR_MESSAGE);
    }
  });

  it("rejects package when tier specifies eligible packages and package is not listed", () => {
    const packageRestrictedTier: TierEligibilityRules = {
      allPackages: false,
      allAccommodation: true,
      eligiblePackageIds: ["pkg-a", "pkg-b"],
    };
    const result = evaluateCouponEligibility(validCoupon, packageRestrictedTier, {
      userId: "user-1",
      subtotalPaise: 600000,
      packageId: "pkg-c",
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe("INELIGIBLE_PACKAGE");
      expect(result.publicReason).toBe(GENERIC_COUPON_ERROR_MESSAGE);
    }
  });
});
