import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { rewardRuleInputSchema, type RewardRuleInput } from "@/lib/schemas/reward-rules";
import { db } from "@/server/db";

export {
  computeRuleImpactSummary,
  type RuleFieldChange,
  type RuleImpactSummary,
} from "@/lib/reward-rules";

export type RewardRuleWithTiers = Prisma.RewardRuleGetPayload<{
  include: {
    tiers: {
      include: {
        packages: true;
        accommodations: true;
      };
    };
  };
}>;

/**
 * Get all reward rule versions ordered by version descending.
 */
export async function getRewardRuleVersions(): Promise<RewardRuleWithTiers[]> {
  return db.rewardRule.findMany({
    orderBy: { version: "desc" },
    include: {
      tiers: {
        include: {
          packages: true,
          accommodations: true,
        },
        orderBy: { pointsCost: "asc" },
      },
    },
  });
}

/**
 * Get the currently active reward rule with its tiers.
 */
export async function getActiveRewardRule(): Promise<RewardRuleWithTiers | null> {
  return db.rewardRule.findFirst({
    where: { isActive: true },
    include: {
      tiers: {
        include: {
          packages: true,
          accommodations: true,
        },
        orderBy: { pointsCost: "asc" },
      },
    },
  });
}

/**
 * Get the latest reward rule version.
 */
export async function getLatestRewardRule(): Promise<RewardRuleWithTiers | null> {
  return db.rewardRule.findFirst({
    orderBy: { version: "desc" },
    include: {
      tiers: {
        include: {
          packages: true,
          accommodations: true,
        },
        orderBy: { pointsCost: "asc" },
      },
    },
  });
}

/**
 * Determines whether a rule is an editable draft:
 * Must not be currently active, must never have been activated (no meta.activatedAt),
 * and must not be referenced by any PointsLedger or Coupon rows.
 */
export async function isRuleEditableDraft(rule: RewardRuleWithTiers): Promise<boolean> {
  if (rule.isActive) return false;
  const meta = (rule.meta as Record<string, unknown> | null) ?? {};
  if (meta["activatedAt"]) return false;

  const [ledgerCount, couponCount] = await Promise.all([
    db.pointsLedger.count({ where: { ruleId: rule.id } }),
    db.coupon.count({
      where: {
        tierId: {
          in: rule.tiers.map((t) => t.id),
        },
      },
    }),
  ]);

  return ledgerCount === 0 && couponCount === 0;
}

/**
 * Get the current editable draft, if one exists.
 * Definition: the latest rule that has never been activated and is not referenced by any ledger/coupon.
 */
export async function getEditableDraftRule(): Promise<RewardRuleWithTiers | null> {
  const latest = await getLatestRewardRule();
  if (!latest) return null;
  const editable = await isRuleEditableDraft(latest);
  return editable ? latest : null;
}

/**
 * Strict immutability check:
 * Enforces that rules and tiers are IMMUTABLE once a rule has ever been activated
 * or referenced by any PointsLedger or Coupon row.
 */
export async function assertRuleIsMutable(ruleId: string): Promise<void> {
  const rule = await db.rewardRule.findUnique({
    where: { id: ruleId },
    include: { tiers: true },
  });

  if (!rule) {
    throw new Error("RULE_NOT_FOUND");
  }

  if (rule.isActive) {
    throw new Error("RULE_IMMUTABLE: Cannot modify an active rule.");
  }

  const meta = (rule.meta as Record<string, unknown> | null) ?? {};
  if (meta["activatedAt"]) {
    throw new Error("RULE_IMMUTABLE: Rule has previously been activated and is permanently immutable.");
  }

  const [ledgerCount, couponCount] = await Promise.all([
    db.pointsLedger.count({ where: { ruleId } }),
    db.coupon.count({
      where: {
        tierId: {
          in: rule.tiers.map((t) => t.id),
        },
      },
    }),
  ]);

  if (ledgerCount > 0) {
    throw new Error("RULE_IMMUTABLE: Rule is referenced by PointsLedger entries and cannot be modified.");
  }

  if (couponCount > 0) {
    throw new Error("RULE_IMMUTABLE: Rule tiers are referenced by Coupon entries and cannot be modified.");
  }
}

/**
 * Creates a brand NEW version of RewardRule.
 * Allocates version number inside a transaction (max(version) + 1) and retries on unique violation.
 * Clears provisional flag on the new version unless explicitly overridden.
 */
export async function createRewardRuleVersion(
  input: RewardRuleInput,
  actorId?: string | null,
  metaOverride?: Prisma.InputJsonObject,
): Promise<RewardRuleWithTiers> {
  // Validate with Zod before saving
  const validated = rewardRuleInputSchema.parse(input);

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const latest = await tx.rewardRule.findFirst({
          orderBy: { version: "desc" },
          select: { version: true, meta: true },
        });

        const nextVersion = (latest?.version ?? 0) + 1;
        const baseMeta = (latest?.meta as Record<string, unknown> | null) ?? {};

        const finalMeta: Prisma.InputJsonObject = metaOverride ?? {
          ...baseMeta,
          provisional: false,
          previousVersion: latest?.version ?? null,
          createdReason: "admin_save_new_version",
        };

        const newRule = await tx.rewardRule.create({
          data: {
            version: nextVersion,
            isActive: false,
            pointsPerApprovedVideo: validated.pointsPerApprovedVideo,
            maxPointsPerCustomer: validated.maxPointsPerCustomer ?? null,
            maxSubmissionsPerPeriod: validated.maxSubmissionsPerPeriod ?? null,
            periodDays: validated.periodDays ?? null,
            pointExpiryDays: validated.pointExpiryDays ?? null,
            minPointsToRedeem: validated.minPointsToRedeem,
            couponValidityDays: validated.couponValidityDays,
            allowCombineWithOffers: validated.allowCombineWithOffers,
            allowMultipleCouponsPerBooking: validated.allowMultipleCouponsPerBooking,
            manualAdjustMaxPoints: validated.manualAdjustMaxPoints,
            manualAdjustApprovalThreshold: validated.manualAdjustApprovalThreshold,
            createdById: actorId ?? null,
            meta: finalMeta,
          },
        });

        for (const tier of validated.tiers) {
          await tx.rewardTier.create({
            data: {
              ruleId: newRule.id,
              name: tier.name,
              pointsCost: tier.pointsCost,
              discountType: tier.discountType,
              discountValue: tier.discountValue,
              maxDiscountPaise: tier.maxDiscountPaise ?? null,
              minBookingPaise: tier.minBookingPaise ?? null,
              allPackages: tier.allPackages,
              allAccommodation: tier.allAccommodation,
              isActive: tier.isActive,
            },
          });
        }

        return tx.rewardRule.findUniqueOrThrow({
          where: { id: newRule.id },
          include: {
            tiers: {
              include: {
                packages: true,
                accommodations: true,
              },
              orderBy: { pointsCost: "asc" },
            },
          },
        });
      });
    } catch (error) {
      if (
        attempt < maxRetries &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Version unique conflict, retry next iteration to pick up incremented version
        continue;
      }
      throw error;
    }
  }

  throw new Error("FAILED_TO_ALLOCATE_VERSION: Max retry attempts reached.");
}


/**
 * Activates a reward rule version in a single atomic transaction:
 * 1. Verifies the target exists and matches expectedVersion.
 * 2. Re-validates with Zod before activating; refuses invalid rules with clear error.
 * 3. Deactivates current active rule first (respecting the partial unique index).
 * 4. Activates target rule, recording meta.activatedAt and meta.deactivatedAt.
 */
export async function activateRewardRuleTransaction(options: {
  ruleId: string;
  expectedVersion: number;
  expectedUpdatedAt?: string;
}): Promise<{
  previousActive: RewardRuleWithTiers | null;
  newlyActivated: RewardRuleWithTiers;
}> {
  return db.$transaction(async (tx) => {
    const target = await tx.rewardRule.findUnique({
      where: { id: options.ruleId },
      include: {
        tiers: {
          include: {
            packages: true,
            accommodations: true,
          },
          orderBy: { pointsCost: "asc" },
        },
      },
    });

    if (!target) {
      throw new Error("RULE_NOT_FOUND: The requested rule version was not found.");
    }

    if (target.version !== options.expectedVersion) {
      throw new Error(
        `CONCURRENCY_CONFLICT: Expected rule version ${options.expectedVersion}, but found version ${target.version}.`,
      );
    }

    if (
      options.expectedUpdatedAt &&
      target.createdAt.toISOString() !== options.expectedUpdatedAt
    ) {
      // RewardRule uses createdAt as its timestamp
      throw new Error(
        "CONCURRENCY_CONFLICT: The rule has been modified since you viewed it. Please refresh.",
      );
    }

    // Strict validation before activating
    const parsed = rewardRuleInputSchema.safeParse({
      pointsPerApprovedVideo: target.pointsPerApprovedVideo,
      maxPointsPerCustomer: target.maxPointsPerCustomer,
      maxSubmissionsPerPeriod: target.maxSubmissionsPerPeriod,
      periodDays: target.periodDays,
      pointExpiryDays: target.pointExpiryDays,
      minPointsToRedeem: target.minPointsToRedeem,
      couponValidityDays: target.couponValidityDays,
      allowCombineWithOffers: target.allowCombineWithOffers,
      allowMultipleCouponsPerBooking: target.allowMultipleCouponsPerBooking,
      manualAdjustMaxPoints: target.manualAdjustMaxPoints,
      manualAdjustApprovalThreshold: target.manualAdjustApprovalThreshold,
      tiers: target.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        pointsCost: t.pointsCost,
        discountType: t.discountType,
        discountValue: t.discountValue,
        maxDiscountPaise: t.maxDiscountPaise,
        minBookingPaise: t.minBookingPaise,
        allPackages: t.allPackages,
        allAccommodation: t.allAccommodation,
        isActive: t.isActive,
      })),
    });

    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join("; ");
      throw new Error(`VALIDATION_ERROR: Rule version ${target.version} is invalid and cannot be activated: ${messages}`);
    }

    // Step 1: Find and deactivate the current active rule first
    const currentActive = await tx.rewardRule.findFirst({
      where: { isActive: true },
      include: {
        tiers: {
          include: {
            packages: true,
            accommodations: true,
          },
        },
      },
    });

    const nowIso = new Date().toISOString();

    if (currentActive && currentActive.id !== target.id) {
      const prevMeta = (currentActive.meta as Record<string, unknown> | null) ?? {};
      await tx.rewardRule.update({
        where: { id: currentActive.id },
        data: {
          isActive: false,
          meta: {
            ...prevMeta,
            deactivatedAt: nowIso,
          },
        },
      });
    }

    // Step 2: Activate the target rule
    const targetMeta = (target.meta as Record<string, unknown> | null) ?? {};
    const newlyActivated = await tx.rewardRule.update({
      where: { id: target.id },
      data: {
        isActive: true,
        meta: {
          ...targetMeta,
          activatedAt: nowIso,
        },
      },
      include: {
        tiers: {
          include: {
            packages: true,
            accommodations: true,
          },
          orderBy: { pointsCost: "asc" },
        },
      },
    });

    return {
      previousActive: currentActive,
      newlyActivated,
    };
  });
}
