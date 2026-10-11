import { z } from "zod";

export const discountTypeSchema = z.enum(["FIXED", "PERCENTAGE"]);

export const rewardTierInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Tier name is required").max(100),
    pointsCost: z.number().int().positive("Points cost must be greater than 0"),
    discountType: discountTypeSchema,
    discountValue: z.number().int().positive("Discount value must be greater than 0"),
    maxDiscountPaise: z.number().int().nonnegative("Max discount must be non-negative").nullable().optional(),
    minBookingPaise: z.number().int().nonnegative("Min booking value must be non-negative").nullable().optional(),
    allPackages: z.boolean().default(true),
    allAccommodation: z.boolean().default(true),
    packageIds: z.array(z.string()).default([]),
    accommodationIds: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "PERCENTAGE") {
      if (data.discountValue < 1 || data.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percentage discount must be between 1% and 100%",
          path: ["discountValue"],
        });
      }
    } else if (data.discountType === "FIXED") {
      if (data.discountValue <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed discount must be greater than 0 paise",
          path: ["discountValue"],
        });
      }
    }
  });

export const rewardRuleInputSchema = z
  .object({
    pointsPerApprovedVideo: z.number().int().positive("Points per approved video must be greater than 0"),
    maxPointsPerCustomer: z.number().int().positive("Max points per customer must be positive").nullable().optional(),
    maxSubmissionsPerPeriod: z.number().int().positive("Max submissions must be positive").nullable().optional(),
    periodDays: z.number().int().positive("Period days must be positive").nullable().optional(),
    pointExpiryDays: z.number().int().positive("Point expiry days must be positive").nullable().optional(),
    minPointsToRedeem: z.number().int().positive("Minimum points to redeem must be greater than 0"),
    couponValidityDays: z.number().int().positive("Coupon validity days must be greater than 0"),
    allowCombineWithOffers: z.boolean().default(false),
    allowMultipleCouponsPerBooking: z.boolean().default(false),
    manualAdjustMaxPoints: z.number().int().nonnegative("Manual adjust max points must be non-negative").default(0),
    manualAdjustApprovalThreshold: z.number().int().nonnegative("Manual adjust approval threshold must be non-negative").default(0),
    tiers: z.array(rewardTierInputSchema).min(1, "At least one tier is required"),
  })
  .superRefine((data, ctx) => {
    // 1. At least one active tier
    const activeTiers = data.tiers.filter((t) => t.isActive);
    if (activeTiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one active reward tier is required",
        path: ["tiers"],
      });
    }

    // 2. Tier pointsCost >= minPointsToRedeem
    data.tiers.forEach((tier, index) => {
      if (tier.pointsCost < data.minPointsToRedeem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Tier points cost (${tier.pointsCost}) cannot be lower than minPointsToRedeem (${data.minPointsToRedeem})`,
          path: ["tiers", index, "pointsCost"],
        });
      }
    });

    // 3. maxPointsPerCustomer >= pointsPerApprovedVideo when set
    if (
      data.maxPointsPerCustomer !== null &&
      data.maxPointsPerCustomer !== undefined &&
      data.maxPointsPerCustomer < data.pointsPerApprovedVideo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum points per customer cannot be less than points per approved video",
        path: ["maxPointsPerCustomer"],
      });
    }

    // 4. periodDays required when maxSubmissionsPerPeriod is set
    if (data.maxSubmissionsPerPeriod !== null && data.maxSubmissionsPerPeriod !== undefined) {
      if (!data.periodDays || data.periodDays <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Period days is required when maximum submissions per period is set",
          path: ["periodDays"],
        });
      }
    }
  });

export type RewardRuleInput = z.infer<typeof rewardRuleInputSchema>;
export type RewardTierInput = z.infer<typeof rewardTierInputSchema>;
