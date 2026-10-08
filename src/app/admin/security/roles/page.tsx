import { z } from "zod";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { PERMISSIONS } from "@/server/authz/permissions";
import { listRoles } from "@/server/services/admin-dashboard";

export default async function AdminRolesPage() {
  const session = await getSession();
  const actor = session ? await getStaffPrincipal(session.user.id) : null;
  if (!actor || !(await can(actor, "roles.write"))) return <NoAccess title={actor && !actor.twoFactorEnabled ? "Set up two-factor authentication" : "Roles access required"} />;
  const roles = await listRoles();
  const matrixSchema = z.array(z.object({ id: z.string().uuid(), permissions: z.array(z.object({ permission: z.object({ key: z.string().min(1) }) })) }));
  const parsedRoles = matrixSchema.parse(roles);
  const permissionKeysByRole = new Map(parsedRoles.map((role) => [role.id, role.permissions.map(({ permission }) => permission.key)]));
  return <div className="space-y-6"><PageHeader eyebrow="Access management" title="Roles & permissions" description="Permission assignments for seeded staff roles. Super Admin receives every permission; Owner/Manager cannot change staff or role assignments." />
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-card"><table className="w-full min-w-[55rem] border-collapse text-left text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="sticky left-0 z-10 min-w-56 bg-muted px-3 py-3">Permission</th>{roles.map((role) => <th key={role.id} className="min-w-32 px-3 py-3 text-center">{role.name}<span className="mt-1 block font-normal text-muted-foreground">{role._count.staff} staff</span></th>)}</tr></thead><tbody className="divide-y divide-border/70">{PERMISSIONS.map((permission) => <tr key={permission} className="hover:bg-muted/30"><th scope="row" className="sticky left-0 z-10 bg-card px-3 py-3 text-left font-mono font-medium">{permission}</th>{roles.map((role) => { const keys = permissionKeysByRole.get(role.id) ?? []; return <td key={role.id} className="px-3 py-3 text-center">{keys.includes(permission) ? <span aria-label={`${role.name} has ${permission}`} className="font-semibold text-forest-700">✓</span> : <span aria-label={`${role.name} does not have ${permission}`} className="text-muted-foreground">—</span>}</td>; })}</tr>)}</tbody></table></div>
    <p className="text-xs text-muted-foreground">Role definitions are seeded from the database permissions. This matrix is read-only in this phase; staff role assignment is managed from the Staff page.</p>
  </div>;
}
