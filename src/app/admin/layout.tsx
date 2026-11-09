import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { NoAccess } from "@/components/admin/NoAccess";
import { adminNavigation, filterAdminNavigation } from "@/config/admin-navigation";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requiresTwoFactor } from "@/server/authz";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") || "";

  // Bypass AdminShell and session check for admin login route
  if (currentPath === "/admin/login" || currentPath.startsWith("/admin/login")) {
    return <>{children}</>;
  }

  const session = await getSession();
  if (!session) {
    const callback = currentPath && currentPath !== "/admin" ? `?callbackUrl=${encodeURIComponent(currentPath)}` : "";
    redirect(`/admin/login${callback}`);
  }

  const staff = await getStaffPrincipal(session.user.id);
  if (!staff) return <NoAccess title="Staff access required" message="The admin workspace is available to invited staff accounts." />;

  if (staff.mustChangePassword) {
    if (currentPath && currentPath !== "/admin/security/change-password") {
      redirect("/admin/security/change-password");
    }
    return (
      <div className="flex min-h-screen flex-col bg-cream-50 text-foreground">
        <header className="border-b bg-cream-100 px-6 py-4">
          <span className="text-lg font-bold text-forest-900 font-serif">Chawan Farms Admin</span>
        </header>
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    );
  }

  if (requiresTwoFactor(staff.roleNames) && !staff.twoFactorEnabled) {
    if (currentPath && currentPath !== "/admin/security/two-factor") {
      redirect("/admin/security/two-factor?step=setup");
    }
  }

  const { PERMISSIONS } = await import("@/server/authz/permissions");
  const allowed = new Set((await Promise.all(PERMISSIONS.map(async (permission) => ({ permission, allowed: await can(staff, permission) })))).filter(({ allowed: isAllowed }) => isAllowed).map(({ permission }) => permission));
  const items = filterAdminNavigation(adminNavigation, allowed);

  return <AdminShell items={items} staff={staff} displayName={session.user.name}>{children}</AdminShell>;
}
