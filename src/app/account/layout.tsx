import type { ReactNode } from "react";

import { AccountNav } from "@/components/account/AccountNav";
import { requireCustomer } from "@/server/auth";
import { getCustomerIdentity } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await requireCustomer();
  const identity = await getCustomerIdentity(session.user.id);
  if (!identity || identity.status === "SUSPENDED" || identity.status === "PENDING_DELETION") {
    return <div className="flex min-h-screen bg-cream-50"><AccountNav /><main className="grid min-h-screen flex-1 place-items-center bg-cream-50 px-6 pt-14 lg:pt-0"><section className="max-w-md rounded-2xl border border-border bg-card p-8 text-center"><h1 className="font-heading text-2xl text-forest-900">Account access is unavailable</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Please contact Chawan Farms if you need help accessing this account.</p></section></main></div>;
  }
  return <div className="flex min-h-screen bg-cream-50"><AccountNav /><div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">{!identity.emailVerified ? <div role="status" className="border-b border-turmeric-500/30 bg-turmeric-500/15 px-4 py-3 text-center text-sm text-ink-900">Verify your email to upload videos, redeem rewards, or submit a booking.</div> : null}{children}</div></div>;
}
