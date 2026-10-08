import NextLink from "next/link";

import { TwoFactorSetup } from "@/components/admin/AdminSecurityControls";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requiresTwoFactor } from "@/server/authz";

export default async function TwoFactorPage() {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff) return <NoAccess title="Staff access required" />;
  if (!(await can(staff, "staff.read", { allowTwoFactorSetup: true }))) return <NoAccess title="Security settings access required" />;
  return <div className="space-y-6"><PageHeader eyebrow="Account security" title="Two-factor authentication" description="Use an authenticator app and keep recovery codes in a secure place." />{staff.twoFactorEnabled ? <div className="rounded-xl border border-forest-700/20 bg-forest-700/5 p-5"><h2 className="font-semibold text-forest-900">Two-factor authentication is enabled</h2><p className="mt-1 text-sm text-muted-foreground">Your admin access is protected with an authenticator.</p></div> : requiresTwoFactor(staff.roleNames) ? <TwoFactorSetup email={session?.user.email ?? ""} /> : <div className="rounded-xl border border-border/70 bg-card p-5"><p className="text-sm">Two-factor authentication is available for this staff account and recommended for all staff.</p></div>}<NextLink href="/admin/security/staff" className="text-sm text-forest-700 underline">Return to staff security</NextLink></div>;
}
