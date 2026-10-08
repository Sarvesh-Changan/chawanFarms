import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell, type AdminNavigationItem } from "@/components/admin/AdminShell";
import { NoAccess } from "@/components/admin/NoAccess";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import type { Permission } from "@/server/authz/permissions";

const navigation = [
  { label: "Dashboard", href: "/admin", permission: "dashboard.read" },
  { label: "CMS", href: "/admin/cms", permission: "cms.read" },
  { label: "Bookings", href: "/admin/bookings", permission: "bookings.read" },
  { label: "Enquiries", href: "/admin/enquiries", permission: "enquiries.read" },
  { label: "Leads", href: "/admin/leads", permission: "leads.read" },
  { label: "Customers", href: "/admin/customers", permission: "customers.read" },
  { label: "Rewards", href: "/admin/rewards", permission: ["rewards.videos.read", "rewards.rules.read", "rewards.ledger.read"] },
  { label: "Media", href: "/admin/media", permission: "media.read" },
  { label: "SEO", href: "/admin/seo", permission: "seo.write" },
  { label: "Settings", href: "/admin/settings", permission: "settings.read" },
  { label: "Security", href: "/admin/security/staff", permission: "staff.read", children: [
    { label: "Staff", href: "/admin/security/staff", permission: "staff.read" },
    { label: "Roles & permissions", href: "/admin/security/roles", permission: "roles.write" },
    { label: "Audit log", href: "/admin/security/audit", permission: "audit.read" },
    { label: "Your sessions", href: "/admin/security/sessions", permission: "staff.read" },
    { label: "Two-factor setup", href: "/admin/security/two-factor", permission: "staff.read" },
  ] },
] satisfies AdminNavigationItem[];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=%2Fadmin");
  const staff = await getStaffPrincipal(session.user.id);
  if (!staff) return <NoAccess title="Staff access required" message="The admin workspace is available to invited staff accounts." />;

  const items = (await Promise.all(navigation.map(async (item) => {
    const children = item.children ? (await Promise.all(item.children.map(async (child) => ({ child, allowed: await can(staff, child.permission as Permission, child.href.endsWith("two-factor") ? { allowTwoFactorSetup: true } : undefined) })))).filter(({ child, allowed }) => allowed || (child.href.endsWith("two-factor") && !staff.twoFactorEnabled && (staff.roleNames.includes("Super Admin") || staff.roleNames.includes("Owner/Manager")))).map(({ child }) => child) : undefined;
    const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];
    const allowed = (await Promise.all(permissions.map((permission) => can(staff, permission as Permission)))).some(Boolean);
    const visible = item.children ? Boolean(children?.length) : allowed;
    return { item: { ...item, ...(children ? { children } : {}) }, visible };
  }))).filter(({ visible }) => visible).map(({ item }) => item);

  return <AdminShell items={items} staff={staff} displayName={session.user.name}>{children}</AdminShell>;
}
