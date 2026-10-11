"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { PROVISIONAL_REWARD_DEFAULTS } from "@/config/reward-defaults";
import { err, ok, type Result } from "@/lib/result";
import { rewardRuleInputSchema } from "@/lib/schemas/reward-rules";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import {
  activateRewardRuleTransaction,
  computeRuleImpactSummary,
  createRewardRuleVersion,
  getActiveRewardRule,
  getEditableDraftRule,
  getLatestRewardRule,
  getRewardRuleVersions,
  type RewardRuleWithTiers,
  type RuleImpactSummary,
} from "@/server/services/admin-rewards";
import { audit } from "@/server/services/audit";

type PreparedMutation =
  | { actorId: string; ip: string; requestHeaders: Headers }
  | { error: Result<never> };

async function prepare(permission: "rewards.rules.read" | "rewards.rules.write"): Promise<PreparedMutation> {
  const requestHeaders = await headers();
  const ip =
    (requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? "unknown")
      .split(",")[0]
      ?.trim()
      .slice(0, 128)
      .replace(/[^a-zA-Z0-9:._-]/g, "_") ?? "unknown";

  try {
    const staff = await requirePermission(permission);
    if (!("id" in staff)) {
      return { error: err("FORBIDDEN", "Staff permission required.") } as const;
    }
    return { actorId: staff.id, ip, requestHeaders } as const;
  } catch (error) {
    return {
      error:
        error instanceof AuthorizationError && error.code === "UNAUTHENTICATED"
          ? err("UNAUTHENTICATED", "Please sign in.")
          : err("FORBIDDEN", "You do not have permission for reward rules."),
    } as const;
  }
}

/**
 * Loads provisional defaults into a brand new draft version.
 * Allowed ONLY when no editable draft currently exists.
 * Permission: rewards.rules.write
 */
export async function loadProvisionalDefaultsAction(): Promise<Result<{ id: string; version: number }>> {
  const prepared = await prepare("rewards.rules.write");
  if ("error" in prepared) return prepared.error;

  const existingDraft = await getEditableDraftRule();
  if (existingDraft) {
    return err(
      "CONFLICT",
      `An editable draft already exists (version ${existingDraft.version}). Review or save changes before loading defaults.`,
    );
  }

  try {
    const newRule = await createRewardRuleVersion(
      PROVISIONAL_REWARD_DEFAULTS,
      prepared.actorId,
      {
        source: "provisional-default",
        provisional: true,
        needsClientApproval: "D-8",
        createdReason: "admin_load_provisional_defaults",
      },
    );

    await audit({
      actor: { id: prepared.actorId, type: "STAFF" },
      action: "rewards.rules.load_provisional_defaults",
      entityType: "RewardRule",
      entityId: newRule.id,
      after: {
        id: newRule.id,
        version: newRule.version,
        provisional: true,
        pointsPerApprovedVideo: newRule.pointsPerApprovedVideo,
      },
      ip: prepared.ip,
      userAgent: prepared.requestHeaders.get("user-agent")?.slice(0, 512),
      requestId: prepared.requestHeaders.get("x-request-id")?.slice(0, 128),
    });

    revalidatePath("/admin/rewards/rules");
    return ok({ id: newRule.id, version: newRule.version });
  } catch (error) {
    return err(
      "INTERNAL",
      error instanceof Error ? error.message : "Failed to load provisional defaults.",
    );
  }
}

/**
 * Saves reward rules as a NEW version (never mutates an active rule).
 * Clears the provisional flag on that new version.
 * Permission: rewards.rules.write
 */
export async function saveRewardRuleVersionAction(
  raw: unknown,
): Promise<Result<{ id: string; version: number }>> {
  const prepared = await prepare("rewards.rules.write");
  if ("error" in prepared) return prepared.error;

  const parsed = rewardRuleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      "VALIDATION",
      "Please review the reward rules settings.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const newRule = await createRewardRuleVersion(parsed.data, prepared.actorId);

    await audit({
      actor: { id: prepared.actorId, type: "STAFF" },
      action: "rewards.rules.create_version",
      entityType: "RewardRule",
      entityId: newRule.id,
      after: {
        id: newRule.id,
        version: newRule.version,
        provisional: false,
        pointsPerApprovedVideo: newRule.pointsPerApprovedVideo,
        tiersCount: newRule.tiers.length,
      },
      ip: prepared.ip,
      userAgent: prepared.requestHeaders.get("user-agent")?.slice(0, 512),
      requestId: prepared.requestHeaders.get("x-request-id")?.slice(0, 128),
    });

    revalidatePath("/admin/rewards/rules");
    return ok({ id: newRule.id, version: newRule.version });
  } catch (error) {
    return err(
      "INTERNAL",
      error instanceof Error ? error.message : "Failed to save reward rule version.",
    );
  }
}

/**
 * Compares draft fields with active rule values for the impact summary.
 * Permission: rewards.rules.read
 */
export async function getRuleImpactSummaryAction(
  rawDraft: unknown,
  draftVersion: number,
): Promise<Result<RuleImpactSummary>> {
  const prepared = await prepare("rewards.rules.read");
  if ("error" in prepared) return prepared.error;

  const parsed = rewardRuleInputSchema.safeParse(rawDraft);
  if (!parsed.success) {
    return err(
      "VALIDATION",
      "Draft values must be valid to compute impact summary.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const activeRule = await getActiveRewardRule();
  const summary = computeRuleImpactSummary(parsed.data, activeRule, draftVersion);
  return ok(summary);
}

const activateSchema = z
  .object({
    ruleId: z.string().uuid("Invalid rule ID"),
    expectedVersion: z.number().int().positive("Invalid expected version"),
    expectedUpdatedAt: z.string().optional(),
  })
  .strict();

/**
 * Activates a reward rule version in a single atomic transaction.
 * Enforces partial unique index by deactivating current active rule first.
 * Re-validates before activating; refuses invalid rules with clear error message.
 * Audits before/after. Revalidates public rewards tags and paths.
 * Permission: rewards.rules.write
 */
export async function activateRewardRuleAction(
  raw: unknown,
): Promise<Result<{ activeVersion: number }>> {
  const prepared = await prepare("rewards.rules.write");
  if ("error" in prepared) return prepared.error;

  const parsed = activateSchema.safeParse(raw);
  if (!parsed.success) {
    return err("VALIDATION", "Invalid activation payload.");
  }

  try {
    const { previousActive, newlyActivated } = await activateRewardRuleTransaction({
      ruleId: parsed.data.ruleId,
      expectedVersion: parsed.data.expectedVersion,
      expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    });

    await audit({
      actor: { id: prepared.actorId, type: "STAFF" },
      action: "rewards.rule.activate",
      entityType: "RewardRule",
      entityId: newlyActivated.id,
      before: previousActive
        ? {
            id: previousActive.id,
            version: previousActive.version,
            pointsPerApprovedVideo: previousActive.pointsPerApprovedVideo,
            isActive: true,
          }
        : null,
      after: {
        id: newlyActivated.id,
        version: newlyActivated.version,
        pointsPerApprovedVideo: newlyActivated.pointsPerApprovedVideo,
        isActive: true,
        activatedAt: (newlyActivated.meta as Record<string, unknown> | null)?.["activatedAt"],
      },
      ip: prepared.ip,
      userAgent: prepared.requestHeaders.get("user-agent")?.slice(0, 512),
      requestId: prepared.requestHeaders.get("x-request-id")?.slice(0, 128),
    });

    revalidateTag("rewards:rule", "max");
    revalidateTag("cms:reward-rule", "max");
    revalidatePath("/rewards");
    revalidatePath("/admin/rewards/rules");
    revalidatePath("/account");

    return ok({ activeVersion: newlyActivated.version });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to activate reward rule.";
    if (msg.startsWith("VALIDATION_ERROR:")) {
      return err("VALIDATION", msg.replace("VALIDATION_ERROR: ", ""));
    }
    if (msg.startsWith("CONCURRENCY_CONFLICT:")) {
      return err("CONFLICT", msg.replace("CONCURRENCY_CONFLICT: ", ""));
    }
    return err("INTERNAL", msg);
  }
}

/**
 * Fetch all versions and state for the admin management view.
 * Permission: rewards.rules.read
 */
export async function getRewardRulesAdminDataAction(): Promise<
  Result<{
    versions: RewardRuleWithTiers[];
    activeRule: RewardRuleWithTiers | null;
    latestRule: RewardRuleWithTiers | null;
    editableDraft: RewardRuleWithTiers | null;
  }>
> {
  const prepared = await prepare("rewards.rules.read");
  if ("error" in prepared) return prepared.error;

  const [versions, activeRule, latestRule, editableDraft] = await Promise.all([
    getRewardRuleVersions(),
    getActiveRewardRule(),
    getLatestRewardRule(),
    getEditableDraftRule(),
  ]);

  return ok({
    versions,
    activeRule,
    latestRule,
    editableDraft,
  });
}
