import { z } from "zod";

import { InviteStaffForm, PendingInvites, StaffManagement } from "@/components/admin/AdminSecurityControls";
import { FilterBar } from "@/components/admin/FilterBar";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { StaffDataTable } from "@/components/admin/StaffDataTable";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { listPendingStaffInvites, listRoles, listStaff } from "@/server/services/admin-dashboard";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), q: z.string().trim().max(100).default(""), sort: z.enum(["createdAt", "name", "status"]).default("createdAt"), direction: z.enum(["asc", "desc"]).default("desc") }).passthrough();
export default async function AdminStaffPage({ searchParams }: PageProps<"/admin/security/staff">) {
  const session = await getSession();
  const staffUser = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staffUser || !(await can(staffUser, "staff.read"))) return <NoAccess title="Staff list access required" />;
  const query = querySchema.parse(await searchParams);
  const canInvite = await can(staffUser, "staff.write");
  const canEditRoles = await can(staffUser, "roles.write");
  const [staff, roles, invites] = await Promise.all([
    listStaff(query.page, 20, query.q, query.sort, query.direction),
    listRoles(),
    canInvite ? listPendingStaffInvites() : Promise.resolve([]),
  ]);
  const roleOptions = roles.map(({ id, name }) => ({ id, name }));
  return <div className="space-y-7">
    <PageHeader eyebrow="Access management" title="Staff" description="Invite staff by email, assign seeded roles, and revoke access during offboarding." />
    {canInvite ? <section className="space-y-3"><h2 className="font-heading text-xl">Invite staff</h2><InviteStaffForm roles={roleOptions} /></section> : null}
    {canInvite ? <section className="space-y-3"><h2 className="font-heading text-xl">Pending invitations</h2><PendingInvites invites={invites} /></section> : null}
    <section className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-heading text-xl">Staff accounts</h2><p className="text-sm text-muted-foreground">{staff.total} staff records</p></div><div className="w-full sm:max-w-md"><FilterBar placeholder="Search staff by name or email" /></div></div><StaffDataTable data={staff.rows} page={staff.page} pageCount={staff.pageCount} pageSize={staff.pageSize} /></section>
    {canEditRoles || canInvite ? <section className="space-y-3"><h2 className="font-heading text-xl">Manage access</h2><StaffManagement staff={staff.rows.map((person) => ({ ...person, roleIds: person.staffRoles.map(({ role }) => role.id) }))} roles={roleOptions} canWrite={canInvite} canManageRoles={canEditRoles} /></section> : null}
  </div>;
}
