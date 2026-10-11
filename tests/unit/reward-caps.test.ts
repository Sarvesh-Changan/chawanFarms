import { describe, expect, it } from "vitest";

import {
  evaluateAdjustCaps,
  evaluateEarnCaps,
  evaluateRedeemCaps,
  type RewardRuleCaps,
  type RewardTierSnapshot,
} from "../../src/server/policies/rewardCaps";

const mockActiveRule: RewardRuleCaps = {
  id: "rule-1",
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
};

const mockTier: RewardTierSnapshot = {
  id: "tier-1",
  ruleId: "rule-1",
  name: "Tier 1",
  pointsCost: 100,
  discountType: "PERCENTAGE",
  discountValue: 5,
  maxDiscountPaise: 50000,
  minBookingPaise: 500000,
  allPackages: true,
  allAccommodation: true,
  isActive: true,
};

describe("evaluateEarnCaps", () => {
  it("awards base points when under lifetime and period caps", () => {
    const result = evaluateEarnCaps({
      rule: mockActiveRule,
      currentLifetimePoints: 200,
      recentPeriodEarnCount: 1,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.pointsToAward).toBe(100);
    }
  });

  it("blocks earn when period submission cap is reached", () => {
    const result = evaluateEarnCaps({
      rule: mockActiveRule,
      currentLifetimePoints: 100,
      recentPeriodEarnCount: 2,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("PERIOD_SUBMISSION_CAP_REACHED");
    }
  });

  it("blocks earn when lifetime points cap is already reached", () => {
    const result = evaluateEarnCaps({
      rule: mockActiveRule,
      currentLifetimePoints: 500,
      recentPeriodEarnCount: 0,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("LIFETIME_CAP_EXCEEDED");
    }
  });

  it("clamps awarded points to remaining lifetime headroom", () => {
    const result = evaluateEarnCaps({
      rule: mockActiveRule,
      currentLifetimePoints: 450,
      recentPeriodEarnCount: 0,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.pointsToAward).toBe(50);
    }
  });
});

describe("evaluateRedeemCaps", () => {
  it("permits redemption when balance and tier rules are satisfied", () => {
    const result = evaluateRedeemCaps({
      rule: mockActiveRule,
      tier: mockTier,
      currentBalance: 150,
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects redemption if tier is inactive", () => {
    const result = evaluateRedeemCaps({
      rule: mockActiveRule,
      tier: { ...mockTier, isActive: false },
      currentBalance: 200,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("TIER_INACTIVE");
    }
  });

  it("rejects redemption if points balance is insufficient", () => {
    const result = evaluateRedeemCaps({
      rule: mockActiveRule,
      tier: mockTier,
      currentBalance: 90,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("INSUFFICIENT_POINTS");
    }
  });

  it("rejects tier below minPointsToRedeem", () => {
    const result = evaluateRedeemCaps({
      rule: mockActiveRule,
      tier: { ...mockTier, pointsCost: 50 },
      currentBalance: 200,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("TIER_BELOW_MIN_REDEEM");
    }
  });
});

describe("evaluateAdjustCaps", () => {
  it("rejects zero points adjustment", () => {
    const result = evaluateAdjustCaps({
      rule: mockActiveRule,
      points: 0,
      reason: "Adjustment",
      currentBalance: 100,
      isSuperAdmin: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("ZERO_POINTS");
  });

  it("rejects empty reason", () => {
    const result = evaluateAdjustCaps({
      rule: mockActiveRule,
      points: 20,
      reason: "   ",
      currentBalance: 100,
      isSuperAdmin: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("EMPTY_REASON");
  });

  it("rejects adjustment that causes negative balance", () => {
    const result = evaluateAdjustCaps({
      rule: mockActiveRule,
      points: -150,
      reason: "Deduction",
      currentBalance: 100,
      isSuperAdmin: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("NEGATIVE_BALANCE");
  });

  it("rejects staff adjustment exceeding manualAdjustMaxPoints", () => {
    const result = evaluateAdjustCaps({
      rule: mockActiveRule,
      points: 75,
      reason: "Customer service gesture",
      currentBalance: 100,
      isSuperAdmin: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("ADJUSTMENT_EXCEEDS_CAP");
  });

  it("permits staff adjustment within cap without second approver", () => {
    const result = evaluateAdjustCaps({
      rule: mockActiveRule,
      points: 40,
      reason: "Customer service gesture",
      currentBalance: 100,
      isSuperAdmin: false,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.requiresSecondApprover).toBe(false);
  });

  it("flags Super Admin adjustment above threshold as requiring second approver", () => {
    const result = evaluateAdjustCaps({
      rule: mockActiveRule,
      points: 250,
      reason: "VIP promotional award",
      currentBalance: 100,
      isSuperAdmin: true,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.requiresSecondApprover).toBe(true);
  });
});
