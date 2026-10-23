import { RedeemButton } from "@/components/account/AccountActions";
import { AccountFrame, EmptyState } from "@/components/account/AccountFrame";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getRewardsPageData } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RewardsPage() {
  const session = await requireUser();
  const data = await getRewardsPageData(session.user.id);
  if (!data) return <AccountFrame title="Rewards"><EmptyState title="Rewards unavailable" body="Your customer profile could not be loaded." /></AccountFrame>;
  return <AccountFrame title="Rewards" description="Points are awarded only after an approved video review. The active rule controls redemption eligibility.">
    <section className="rounded-2xl bg-forest-900 p-6 text-cream-50"><p className="text-sm text-paddy-300">Available balance</p><p className="font-heading mt-2 text-5xl">{data.pointsBalance}</p><p className="mt-1 text-sm text-cream-50/70">points</p></section>
    {!data.rule ? <div className="mt-6"><EmptyState title="Rewards are currently unavailable" body="There is no active rewards rule. Nothing can be redeemed until the rewards service is enabled." /></div> : <>
      <section className="mt-6"><h2 className="font-heading text-2xl text-forest-900">Redeem points</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{data.rule.tiers.length === 0 ? <EmptyState title="No tiers available" body="No active redemption tiers are configured." /> : data.rule.tiers.map((tier) => <article key={tier.id} className="rounded-2xl border border-border/70 bg-card p-5"><h3 className="font-heading text-xl text-forest-900">{tier.name}</h3><p className="mt-2 text-sm text-muted-foreground">{tier.pointsCost} points · {tier.discountType === "PERCENTAGE" ? `${tier.discountValue}% off` : `${formatINR(tier.discountValue)} off`}</p>{tier.minBookingPaise ? <p className="mt-1 text-xs text-muted-foreground">Eligible bookings from {formatINR(tier.minBookingPaise)}</p> : null}<div className="mt-4"><RedeemButton tierId={tier.id} disabled={!data.emailVerified || data.pointsBalance < tier.pointsCost} /></div>{!data.emailVerified ? <p className="mt-2 text-xs text-muted-foreground">Verify your email before redeeming.</p> : null}</article>)}</div></section>
      <section className="mt-8"><h2 className="font-heading text-2xl text-forest-900">Points timeline</h2>{data.ledger.length === 0 ? <div className="mt-4"><EmptyState title="No points activity yet" body="Approved videos and redemptions will appear here." /></div> : <ol className="mt-4 grid gap-3">{data.ledger.map((entry) => <li key={entry.id} className="rounded-2xl border border-border/70 bg-card p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium text-forest-900">{entry.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(entry.createdAt)}{entry.reason ? ` · ${entry.reason}` : ""}</p></div><p className={entry.points >= 0 ? "font-semibold text-leaf-500" : "font-semibold text-laterite-600"}>{entry.points >= 0 ? "+" : ""}{entry.points}</p></div></li>)}</ol>}</section>
    </>}
  </AccountFrame>;
}
