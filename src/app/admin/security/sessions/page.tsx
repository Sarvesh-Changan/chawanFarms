import { NoAccess } from "@/components/admin/NoAccess";
import { OwnSessions } from "@/components/admin/OwnSessions";
import { PageHeader } from "@/components/admin/PageHeader";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { listCurrentUserSessions } from "@/server/services/admin-dashboard";

export default async function AdminSessionsPage() {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!session || !staff || !(await can(staff, "staff.read"))) return <NoAccess title="Sessions access required" />;
  const sessions = await listCurrentUserSessions(staff.id, session.session.token);
  return <div className="space-y-6"><PageHeader eyebrow="Account security" title="Your sessions" description="Review and revoke active sessions for your staff account." /><OwnSessions sessions={sessions} isDevelopment={process.env.APP_ENV === "development"} /></div>;
}
