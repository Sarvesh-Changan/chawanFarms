import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { NoAccess } from "@/components/admin/NoAccess";
import { adminNavigation, filterAdminNavigation } from "@/config/admin-navigation";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=%2Fadmin");
  const staff = await getStaffPrincipal(session.user.id);
  if (!staff) return <NoAccess title="Staff access required" message="The admin workspace is available to invited staff accounts." />;

  const { PERMISSIONS } = await import("@/server/authz/permissions");
  const allowed = new Set((await Promise.all(PERMISSIONS.map(async (permission) => ({ permission, allowed: await can(staff, permission) })))).filter(({ allowed: isAllowed }) => isAllowed).map(({ permission }) => permission));
  const items = filterAdminNavigation(adminNavigation, allowed);

  return <AdminShell items={items} staff={staff} displayName={session.user.name}>{children}</AdminShell>;
}
