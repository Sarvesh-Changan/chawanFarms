/**
 * Pure policy helpers for Reward Engine caps and validations.
 * No database or framework dependencies.
 *
 * Enforces caps from the ACTIVE RewardRule:
 * - Lifetime points cap
 * - Rolling period submission cap
 * - Minimum redemption threshold
 * - Manual adjustment limits and second-approver threshold
 */

export type RewardRuleCaps = {
  id: string;
  pointsPerApprovedVideo: number;
  maxPointsPerCustomer: number | null;
  maxSubmissionsPerPeriod: number | null;
  periodDays: number | null;
  pointExpiryDays: number | null;
  minPointsToRedeem: number;
  couponValidityDays: number;
  allowCombineWithOffers: boolean;
  allowMultipleCouponsPerBooking: boolean;
  manualAdjustMaxPoints: number;
  manualAdjustApprovalThreshold: number;
};

export type RewardTierSnapshot = {
  id: string;
  ruleId: string;
  name: string;
  pointsCost: number;
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number;
  maxDiscountPaise: number | null;
  minBookingPaise: number | null;
  allPackages: boolean;
  allAccommodation: boolean;
  isActive: boolean;
};

export type EarnCapsEvaluation =
  | { allowed: true; pointsToAward: number }
  | { allowed: false; code: "LIFETIME_CAP_EXCEEDED" | "PERIOD_SUBMISSION_CAP_REACHED"; message: string };

export function evaluateEarnCaps(input: {
  rule: RewardRuleCaps;
  currentLifetimePoints: number;
  recentPeriodEarnCount: number;
}): EarnCapsEvaluation {
  const { rule, currentLifetimePoints, recentPeriodEarnCount } = input;

  if (
    rule.maxSubmissionsPerPeriod !== null &&
    rule.periodDays !== null &&
    recentPeriodEarnCount >= rule.maxSubmissionsPerPeriod
  ) {
    return {
      allowed: false,
      code: "PERIOD_SUBMISSION_CAP_REACHED",
      message: `Maximum video submissions (${rule.maxSubmissionsPerPeriod}) reached for the current ${rule.periodDays}-day period.`,
    };
  }

  if (
    rule.maxPointsPerCustomer !== null &&
    currentLifetimePoints >= rule.maxPointsPerCustomer
  ) {
    return {
      allowed: false,
      code: "LIFETIME_CAP_EXCEEDED",
      message: `Customer has reached the lifetime points cap of ${rule.maxPointsPerCustomer}.`,
    };
  }

  const basePoints = rule.pointsPerApprovedVideo;
  if (rule.maxPointsPerCustomer !== null) {
    const remaining = rule.maxPointsPerCustomer - currentLifetimePoints;
    if (remaining < basePoints) {
      return {
        allowed: true,
        pointsToAward: Math.max(0, remaining),
      };
    }
  }

  return { allowed: true, pointsToAward: basePoints };
}

export type RedeemCapsEvaluation =
  | { allowed: true }
  | {
      allowed: false;
      code: "TIER_BELOW_MIN_REDEEM" | "INSUFFICIENT_POINTS" | "TIER_INACTIVE" | "INVALID_POINTS_COST";
      message: string;
    };

export function evaluateRedeemCaps(input: {
  rule: RewardRuleCaps;
  tier: RewardTierSnapshot;
  currentBalance: number;
}): RedeemCapsEvaluation {
  const { rule, tier, currentBalance } = input;

  if (!tier.isActive) {
    return {
      allowed: false,
      code: "TIER_INACTIVE",
      message: "The requested reward tier is not currently active.",
    };
  }

  if (tier.pointsCost <= 0) {
    return {
      allowed: false,
      code: "INVALID_POINTS_COST",
      message: "Reward tier cost must be greater than zero.",
    };
  }

  if (tier.pointsCost < rule.minPointsToRedeem) {
    return {
      allowed: false,
      code: "TIER_BELOW_MIN_REDEEM",
      message: `Tier points cost (${tier.pointsCost}) is below the minimum redemption requirement (${rule.minPointsToRedeem}).`,
    };
  }

  if (currentBalance < tier.pointsCost) {
    return {
      allowed: false,
      code: "INSUFFICIENT_POINTS",
      message: `Insufficient points balance (${currentBalance}) for tier cost (${tier.pointsCost}).`,
    };
  }

  return { allowed: true };
}

export type AdjustCapsEvaluation =
  | { allowed: true; requiresSecondApprover: boolean }
  | {
      allowed: false;
      code: "ZERO_POINTS" | "EMPTY_REASON" | "NEGATIVE_BALANCE" | "ADJUSTMENT_EXCEEDS_CAP";
      message: string;
    };

export function evaluateAdjustCaps(input: {
  rule: RewardRuleCaps;
  points: number;
  reason: string;
  currentBalance: number;
  isSuperAdmin: boolean;
}): AdjustCapsEvaluation {
  const { rule, points, reason, currentBalance, isSuperAdmin } = input;

  if (points === 0) {
    return {
      allowed: false,
      code: "ZERO_POINTS",
      message: "Adjustment points cannot be zero.",
    };
  }

  if (!reason || reason.trim().length === 0) {
    return {
      allowed: false,
      code: "EMPTY_REASON",
      message: "A mandatory justification reason is required for points adjustments.",
    };
  }

  if (currentBalance + points < 0) {
    return {
      allowed: false,
      code: "NEGATIVE_BALANCE",
      message: `Adjustment would cause balance (${currentBalance + points}) to drop below zero.`,
    };
  }

  const absPoints = Math.abs(points);

  if (!isSuperAdmin && rule.manualAdjustMaxPoints > 0 && absPoints > rule.manualAdjustMaxPoints) {
    return {
      allowed: false,
      code: "ADJUSTMENT_EXCEEDS_CAP",
      message: `Adjustment points (${absPoints}) exceed the per-action staff cap of ${rule.manualAdjustMaxPoints}.`,
    };
  }

  const requiresSecondApprover =
    rule.manualAdjustApprovalThreshold > 0 && absPoints > rule.manualAdjustApprovalThreshold;

  return { allowed: true, requiresSecondApprover };
}
