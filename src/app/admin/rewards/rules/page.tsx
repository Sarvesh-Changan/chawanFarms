import type { Metadata } from "next";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { RewardRulesManager } from "@/components/admin/rewards/RewardRulesManager";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requirePermission } from "@/server/authz";
import { db } from "@/server/db";
import {
  getActiveRewardRule,
  getEditableDraftRule,
  getLatestRewardRule,
  getRewardRuleVersions,
} from "@/server/services/admin-rewards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reward Rules Management · Chawan Farms Admin",
};

export default async function RewardRulesPage() {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff) {
    return (
      <NoAccess
        title="Staff access required"
        message="The admin workspace is available to invited staff accounts."
      />
    );
  }

  try {
    await requirePermission("rewards.rules.read");
  } catch {
    return (
      <NoAccess
        title="Reward access required"
        message="Your staff role does not have permission to view reward rules."
      />
    );
  }

  const canWrite = await can(staff, "rewards.rules.write");

  const [versions, activeRule, latestRule, editableDraft, packagesRaw, accommodationsRaw] =
    await Promise.all([
      getRewardRuleVersions(),
      getActiveRewardRule(),
      getLatestRewardRule(),
      getEditableDraftRule(),
      db.package.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
        orderBy: { sortOrder: "asc" },
      }),
      db.accommodation.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

  const packages = packagesRaw.map((p) => ({
    id: p.id,
    name:
      (p.name as { en?: string } | null)?.en ??
      (typeof p.name === "string" ? p.name : p.slug),
  }));

  const accommodations = accommodationsRaw.map((a) => ({
    id: a.id,
    name:
      (a.name as { en?: string } | null)?.en ??
      (typeof a.name === "string" ? a.name : a.slug),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rewards Configuration"
        title="Reward Rules &amp; Tiers"
        description="Versioned customer loyalty rules. Reward engine rules are strictly read from the active database rule."
      />

      <RewardRulesManager
        versions={versions}
        activeRule={activeRule}
        latestRule={latestRule}
        editableDraft={editableDraft}
        canWrite={canWrite}
        availablePackages={packages}
        availableAccommodations={accommodations}
      />
    </div>
  );
}
