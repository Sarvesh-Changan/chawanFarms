import { CopyCodeButton } from "@/components/account/AccountActions";
import { AccountFrame, EmptyState, StatusChip } from "@/components/account/AccountFrame";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getCouponsPageData } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CouponsPage() {
  const session = await requireUser();
  const data = await getCouponsPageData(session.user.id);
  return <AccountFrame title="Coupons" description="Coupons issued to this account, with server-enforced expiry and eligibility.">
    {!data.features.coupons ? <EmptyState title="Coupons are unavailable" body="The coupons feature is currently disabled." /> : data.coupons.length === 0 ? <EmptyState title="No coupons yet" body="Redeemed rewards will appear here when the rewards service issues a coupon." /> : <div className="grid gap-4 sm:grid-cols-2">{data.coupons.map((coupon) => <article key={coupon.id} className="rounded-2xl border border-border/70 bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.16em] text-laterite-600 uppercase">{coupon.tier.name}</p><p className="mt-2 font-mono text-xl font-semibold text-forest-900">{coupon.code}</p></div><StatusChip value={coupon.status} /></div><p className="mt-4 text-sm text-muted-foreground">{coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}% discount` : `${formatINR(coupon.discountValue)} discount`}{coupon.maxDiscountPaise ? ` up to ${formatINR(coupon.maxDiscountPaise)}` : ""}.</p><p className="mt-1 text-sm text-muted-foreground">Valid until {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(coupon.expiresAt)}. {coupon.minBookingPaise ? `Eligible from ${formatINR(coupon.minBookingPaise)}.` : "Eligibility is checked by the booking service."}</p><div className="mt-4"><CopyCodeButton code={coupon.code} /></div>{coupon.status === "ACTIVE" ? <p className="mt-3 text-xs text-muted-foreground">Apply on next booking is hidden until the booking flow supports selecting an owned coupon end to end.</p> : null}</article>)}</div>}
  </AccountFrame>;
}
