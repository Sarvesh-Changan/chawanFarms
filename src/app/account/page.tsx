import Link from "next/link";

import { requireUser } from "@/server/auth";
import { getPublicActiveRewardRule } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [session, activeRule] = await Promise.all([
    requireUser(),
    getPublicActiveRewardRule(),
  ]);

  const hasActiveRule = Boolean(activeRule && activeRule.isActive);

  return (
    <main className="bg-cream-50 min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Account</p>
          <h1 className="font-heading text-forest-900 mt-2 text-4xl">Welcome, {session.user.name}</h1>
          <p className="text-muted-foreground mt-2">{session.user.email}</p>
        </div>

        {/* Rewards Section */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <div>
              <h2 className="font-heading text-xl text-forest-900">Your Farm Rewards</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share authentic videos of your farm stay to earn reward points.
              </p>
            </div>
            <Link
              href="/rewards"
              className="text-xs font-semibold text-forest-700 hover:text-forest-900 underline underline-offset-4"
            >
              How rewards work →
            </Link>
          </div>

          <div className="mt-4">
            {hasActiveRule && activeRule ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs text-muted-foreground">Earning Rate</p>
                    <p className="font-heading text-2xl text-forest-900 mt-1">
                      {activeRule.pointsPerApprovedVideo} Points
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">per approved video submission</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs text-muted-foreground">Min Redemption</p>
                    <p className="font-heading text-2xl text-forest-900 mt-1">
                      {activeRule.minPointsToRedeem} Points
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Coupon valid for {activeRule.couponValidityDays} days
                    </p>
                  </div>
                </div>

                {activeRule.tiers.length > 0 ? (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-foreground mb-2">Available Redemption Tiers:</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeRule.tiers.map((tier) => (
                        <div key={tier.id} className="rounded-lg border border-border/60 p-3 text-xs flex justify-between items-center">
                          <span className="font-medium text-forest-900">{tier.name}</span>
                          <span className="font-semibold text-forest-700">
                            {tier.pointsCost} pts (
                            {tier.discountType === "PERCENTAGE"
                              ? `${tier.discountValue}% OFF`
                              : `₹${Math.round(tier.discountValue / 100)} OFF`}
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Rewards program details and earning options will be displayed here once active rules are published. Check back soon for earning and redemption opportunities.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
