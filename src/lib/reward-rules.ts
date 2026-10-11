import type { RewardRuleInput } from "@/lib/schemas/reward-rules";

export type RuleFieldChange = {
  field: string;
  label: string;
  previousValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
};

export type RuleImpactSummary = {
  hasActiveRule: boolean;
  activeVersion: number | null;
  targetVersion: number;
  changes: RuleFieldChange[];
  tierChanges: {
    tierName: string;
    action: "added" | "removed" | "modified" | "unchanged";
    details: string;
  }[];
};

export type ActiveRuleForComparison = {
  version: number;
  pointsPerApprovedVideo: number;
  maxPointsPerCustomer?: number | null;
  maxSubmissionsPerPeriod?: number | null;
  periodDays?: number | null;
  pointExpiryDays?: number | null;
  minPointsToRedeem: number;
  couponValidityDays: number;
  allowCombineWithOffers: boolean;
  allowMultipleCouponsPerBooking: boolean;
  manualAdjustMaxPoints: number;
  manualAdjustApprovalThreshold: number;
  tiers: {
    name: string;
    pointsCost: number;
    discountType: "FIXED" | "PERCENTAGE";
    discountValue: number;
    maxDiscountPaise?: number | null;
    minBookingPaise?: number | null;
    allPackages: boolean;
    allAccommodation: boolean;
    isActive: boolean;
  }[];
};

/**
 * Compares draft values against current active rule.
 * Strictly compares field values only; does not estimate cost or revenue.
 */
export function computeRuleImpactSummary(
  draft: RewardRuleInput,
  activeRule: ActiveRuleForComparison | null,
  draftVersion: number,
): RuleImpactSummary {
  const changes: RuleFieldChange[] = [];

  const compareField = (
    field: string,
    label: string,
    prev: string | number | boolean | null,
    next: string | number | boolean | null,
  ) => {
    if (prev !== next) {
      changes.push({ field, label, previousValue: prev, newValue: next });
    }
  };

  const active = activeRule;

  compareField(
    "pointsPerApprovedVideo",
    "Points per Approved Video",
    active?.pointsPerApprovedVideo ?? null,
    draft.pointsPerApprovedVideo,
  );
  compareField(
    "maxPointsPerCustomer",
    "Max Points per Customer",
    active?.maxPointsPerCustomer ?? null,
    draft.maxPointsPerCustomer ?? null,
  );
  compareField(
    "maxSubmissionsPerPeriod",
    "Max Submissions per Period",
    active?.maxSubmissionsPerPeriod ?? null,
    draft.maxSubmissionsPerPeriod ?? null,
  );
  compareField(
    "periodDays",
    "Submission Period (Days)",
    active?.periodDays ?? null,
    draft.periodDays ?? null,
  );
  compareField(
    "pointExpiryDays",
    "Point Expiry (Days)",
    active?.pointExpiryDays ?? null,
    draft.pointExpiryDays ?? null,
  );
  compareField(
    "minPointsToRedeem",
    "Min Points to Redeem",
    active?.minPointsToRedeem ?? null,
    draft.minPointsToRedeem,
  );
  compareField(
    "couponValidityDays",
    "Coupon Validity (Days)",
    active?.couponValidityDays ?? null,
    draft.couponValidityDays,
  );
  compareField(
    "allowCombineWithOffers",
    "Combine with Offers",
    active?.allowCombineWithOffers ?? null,
    draft.allowCombineWithOffers,
  );
  compareField(
    "allowMultipleCouponsPerBooking",
    "Multiple Coupons per Booking",
    active?.allowMultipleCouponsPerBooking ?? null,
    draft.allowMultipleCouponsPerBooking,
  );
  compareField(
    "manualAdjustMaxPoints",
    "Manual Adjust Cap (Points)",
    active?.manualAdjustMaxPoints ?? null,
    draft.manualAdjustMaxPoints,
  );
  compareField(
    "manualAdjustApprovalThreshold",
    "Manual Adjust Approval Threshold (Points)",
    active?.manualAdjustApprovalThreshold ?? null,
    draft.manualAdjustApprovalThreshold,
  );

  // Tiers comparison
  const tierChanges: RuleImpactSummary["tierChanges"] = [];
  const activeTiers = active?.tiers ?? [];

  for (const draftTier of draft.tiers) {
    const existing = activeTiers.find((t) => t.name.toLowerCase() === draftTier.name.toLowerCase());
    if (!existing) {
      tierChanges.push({
        tierName: draftTier.name,
        action: "added",
        details: `Cost: ${draftTier.pointsCost} pts, Discount: ${draftTier.discountValue}${draftTier.discountType === "PERCENTAGE" ? "%" : " paise"}`,
      });
    } else {
      const isModified =
        existing.pointsCost !== draftTier.pointsCost ||
        existing.discountType !== draftTier.discountType ||
        existing.discountValue !== draftTier.discountValue ||
        existing.maxDiscountPaise !== (draftTier.maxDiscountPaise ?? null) ||
        existing.minBookingPaise !== (draftTier.minBookingPaise ?? null) ||
        existing.allPackages !== draftTier.allPackages ||
        existing.allAccommodation !== draftTier.allAccommodation ||
        existing.isActive !== draftTier.isActive;

      tierChanges.push({
        tierName: draftTier.name,
        action: isModified ? "modified" : "unchanged",
        details: isModified
          ? `Points: ${existing.pointsCost} → ${draftTier.pointsCost}, Discount: ${existing.discountValue} → ${draftTier.discountValue}`
          : "Identical to current active tier",
      });
    }
  }

  for (const activeTier of activeTiers) {
    const inDraft = draft.tiers.some((t) => t.name.toLowerCase() === activeTier.name.toLowerCase());
    if (!inDraft) {
      tierChanges.push({
        tierName: activeTier.name,
        action: "removed",
        details: "Tier removed from new rule version",
      });
    }
  }

  return {
    hasActiveRule: Boolean(activeRule),
    activeVersion: activeRule?.version ?? null,
    targetVersion: draftVersion,
    changes,
    tierChanges,
  };
}
