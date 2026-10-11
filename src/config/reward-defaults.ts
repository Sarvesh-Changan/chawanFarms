/**
 * PROVISIONAL PLACEHOLDERS — NOT CLIENT-APPROVED.
 *
 * Subject to client decision D-8 in docs/OPEN_QUESTIONS.md.
 * These default values serve only as provisional operational placeholders and
 * can be modified or activated at any time by authorized staff in the admin UI.
 *
 * All monetary amounts are in paise (e.g., 50000 paise = ₹500, 500000 paise = ₹5,000).
 *
 * BOUNDARY RULE:
 * This file may ONLY be imported by:
 * 1. prisma/seed.ts (for create-only initial seeding when the table is empty)
 * 2. src/server/actions/admin-rewards.ts (for the "Load provisional defaults" admin action)
 *
 * Reward engines, coupon logic, and public views must read rules EXCLUSIVELY
 * from the database (active RewardRule + RewardTier).
 */

import { rewardRuleInputSchema, type RewardRuleInput } from "@/lib/schemas/reward-rules";

export const PROVISIONAL_REWARD_DEFAULTS: RewardRuleInput = rewardRuleInputSchema.parse({
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
  tiers: [
    {
      name: "Tier 1",
      pointsCost: 100,
      discountType: "PERCENTAGE",
      discountValue: 5,
      maxDiscountPaise: 50000,
      minBookingPaise: 500000,
      allPackages: true,
      allAccommodation: true,
      isActive: true,
      packageIds: [],
      accommodationIds: [],
    },
    {
      name: "Tier 2",
      pointsCost: 250,
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxDiscountPaise: 100000,
      minBookingPaise: 1000000,
      allPackages: true,
      allAccommodation: true,
      isActive: true,
      packageIds: [],
      accommodationIds: [],
    },
  ],
});
