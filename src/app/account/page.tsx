import Link from "next/link";

import { AccountFrame } from "@/components/account/AccountFrame";
import { Button } from "@/components/ui/button";
import { requireCustomer } from "@/server/auth";
import { getAccountOverview } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function displayDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(value);
}

export default async function AccountPage() {
  const session = await requireCustomer();
  const overview = await getAccountOverview(session.user.id);
  if (!overview) return <AccountFrame title="Overview"><div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><h2 className="font-heading text-xl text-forest-900">Account unavailable</h2><p className="mt-2 text-sm text-muted-foreground">We could not find your customer profile.</p></div></AccountFrame>;
  const progress = overview.pointsBalance > 0 ? Math.min(100, Math.round((overview.pointsBalance / Math.max(overview.pointsBalance, 1_000)) * 100)) : 0;
  return <AccountFrame title={`Welcome back, ${overview.identity.name}`} description="A simple view of your stays, rewards and account activity.">
    <div className="grid gap-4 md:grid-cols-3">
      <section className="rounded-2xl bg-forest-900 p-5 text-cream-50" aria-labelledby="points-heading"><div className="flex items-center gap-5"><div className="grid size-24 place-items-center rounded-full" style={{ background: `conic-gradient(var(--turmeric-500) ${progress}%, rgba(255,255,255,.18) ${progress}% 100%)` }}><div className="grid size-16 place-items-center rounded-full bg-forest-900 text-center"><span className="text-xl font-semibold">{overview.pointsBalance}</span><span className="text-[0.6rem] uppercase">points</span></div></div><div><h2 id="points-heading" className="font-heading text-xl">Your points</h2><Link href="/account/rewards" className="mt-1 inline-block text-sm text-paddy-300 underline underline-offset-4">View rewards</Link></div></div></section>
      <section className="rounded-2xl border border-border/70 bg-card p-5"><p className="text-sm text-muted-foreground">Active coupons</p><p className="font-heading mt-2 text-4xl text-forest-900">{overview.activeCoupons}</p><Link href="/account/coupons" className="mt-3 inline-block text-sm font-medium text-forest-700 underline underline-offset-4">View coupons</Link></section>
      <section className="rounded-2xl border border-border/70 bg-card p-5"><p className="text-sm text-muted-foreground">Pending videos</p><p className="font-heading mt-2 text-4xl text-forest-900">{overview.pendingVideos}</p><Link href="/account/videos" className="mt-3 inline-block text-sm font-medium text-forest-700 underline underline-offset-4">View submissions</Link></section>
    </div>
    <section className="mt-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.16em] text-laterite-600 uppercase">Next stay</p><h2 className="font-heading mt-2 text-2xl text-forest-900">{overview.nextStay ? displayDate(overview.nextStay.checkIn) : "No confirmed stay yet"}</h2>{overview.nextStay ? <p className="mt-1 text-sm text-muted-foreground">{overview.nextStay.reference}{overview.nextStay.packageSlug ? ` · ${overview.nextStay.packageSlug}` : ""} · Until {displayDate(overview.nextStay.checkOut)}</p> : <p className="mt-1 text-sm text-muted-foreground">When a booking is confirmed, it will appear here.</p>}</div><div className="flex flex-wrap gap-3"><Button asChild><Link href={overview.lastPackageSlug ? `/book?package=${encodeURIComponent(overview.lastPackageSlug)}` : "/book"}>Book again</Link></Button><Button asChild variant="outline"><Link href="/account/videos/new">Upload video</Link></Button></div></div></section>
    <section className="mt-6 grid gap-4 sm:grid-cols-2"><Link href="/account/bookings" className="rounded-2xl border border-border/70 bg-card p-5 transition hover:border-forest-700"><p className="text-sm text-muted-foreground">Bookings &amp; enquiries</p><p className="font-heading mt-2 text-xl text-forest-900">See your requests</p></Link><Link href="/account/favourites" className="rounded-2xl border border-border/70 bg-card p-5 transition hover:border-forest-700"><p className="text-sm text-muted-foreground">Saved for later</p><p className="font-heading mt-2 text-xl text-forest-900">Open favourites</p></Link></section>
  </AccountFrame>;
}
