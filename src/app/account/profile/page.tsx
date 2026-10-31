import { ProfileForm } from "@/components/account/AccountActions";
import { AccountFrame, EmptyState } from "@/components/account/AccountFrame";
import { CustomerLogoutButton } from "@/components/account/CustomerLogoutButton";
import { requireCustomer } from "@/server/auth";
import { getProfilePageData } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const session = await requireCustomer();
  const data = await getProfilePageData(session.user.id);
  if (!data) return <AccountFrame title="Profile"><EmptyState title="Profile unavailable" body="Your customer profile could not be loaded." /></AccountFrame>;
  return (
    <AccountFrame
      title="Profile"
      description="Keep your contact details current. Email changes are managed separately and are not part of this account phase."
      action={<CustomerLogoutButton variant="outline" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,38rem)_1fr]">
        <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
          <ProfileForm initial={{ name: data.identity.name, phone: data.identity.profile?.phone ?? null, city: data.identity.profile?.city ?? null, marketingConsent: data.identity.profile?.marketingConsent ?? false }} />
          <div className="mt-6 border-t border-border pt-5 text-sm">
            <p className="text-muted-foreground">Email</p>
            <p className="mt-1 font-medium">{data.identity.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.identity.emailVerified ? "Verified" : "Verification required for bookings and rewards"}</p>
          </div>
        </section>
        {data.features.referrals ? (
          <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
            <p className="text-xs font-semibold tracking-[0.16em] text-laterite-600 uppercase">Referral</p>
            <h2 className="font-heading mt-2 text-2xl text-forest-900">Your referral code</h2>
            <p className="mt-2 text-sm text-muted-foreground">Share this code when the referral programme is active. Rewards logic is not part of this phase.</p>
            <p className="mt-5 rounded-lg bg-muted px-4 py-3 font-mono text-lg">{data.identity.profile?.referralCode ?? "—"}</p>
          </section>
        ) : null}
      </div>
    </AccountFrame>
  );
}
