import { OwnSessions } from "@/components/admin/AdminSecurityControls";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { listCurrentUserSessions } from "@/server/services/admin-dashboard";

export default async function AdminSessionsPage() {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff || !(await can(staff, "staff.read"))) return <NoAccess title={staff && !staff.twoFactorEnabled ? "Set up two-factor authentication" : "Sessions access required"} />;
  const sessions = await listCurrentUserSessions(staff.id);
  return <div className="space-y-6"><PageHeader eyebrow="Account security" title="Your sessions" description="Review and revoke active sessions for your staff account." /><OwnSessions sessions={sessions} currentSessionId={session?.session.id ?? ""} /></div>;
}
