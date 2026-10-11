import Link from "next/link";

import { requireUser } from "@/server/auth";
import { getPublicActiveRewardRule } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export default async function AccountPointsPage() {
  const [session, activeRule] = await Promise.all([
    requireUser(),
    getPublicActiveRewardRule(),
  ]);

  const hasActiveRule = Boolean(activeRule && activeRule.isActive);

  return (
    <main className="bg-cream-50 min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/account" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to Account
          </Link>
          <h1 className="font-heading text-forest-900 mt-2 text-3xl">Points &amp; Rewards</h1>
          <p className="text-muted-foreground text-sm mt-1">{session.user.email}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          {hasActiveRule && activeRule ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Active rules allow earning <strong className="text-forest-900">{activeRule.pointsPerApprovedVideo} points</strong> per approved video.
                Redeem for discounts starting at <strong className="text-forest-900">{activeRule.minPointsToRedeem} points</strong>.
              </p>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Rewards program details and points earning are currently being finalized. No active reward rules are in effect right now.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
