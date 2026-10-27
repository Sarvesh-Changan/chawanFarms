import type { Permission } from "@/server/authz/permissions";

export type AdminNavigationDefinition = {
  label: string;
  href: string;
  permission: Permission | readonly Permission[];
  children?: readonly AdminNavigationDefinition[];
};

export const adminNavigation = [
  { label: "Dashboard", href: "/admin", permission: "dashboard.read" },
  { label: "Activity", href: "/admin/activities", permission: "cms.read" },
  { label: "Stories", href: "/admin/stories", permission: "cms.read" },
  { label: "Gallery", href: "/admin/gallery", permission: "cms.read" },
  { label: "Menu", href: "/admin/menu", permission: "cms.read" },
  { label: "FAQ", href: "/admin/faqs", permission: "cms.read" },
  { label: "Packages", href: "/admin/packages", permission: "cms.read" },
  { label: "Accommodation", href: "/admin/accommodation", permission: "cms.read" },
  { label: "Bookings", href: "/admin/bookings", permission: "bookings.read", children: [
    { label: "All Bookings", href: "/admin/bookings", permission: "bookings.read" },
    { label: "New Booking", href: "/admin/bookings/new", permission: "bookings.write" },
    { label: "Arrivals & Calendar", href: "/admin/calendar", permission: "bookings.read" },
    { label: "Availability Grid", href: "/admin/availability", permission: "bookings.read" },
  ] },
  { label: "Enquiries", href: "/admin/enquiries", permission: "enquiries.read" },
  { label: "Leads", href: "/admin/leads", permission: "leads.read" },
  { label: "Rewards", href: "/admin/rewards/rules", permission: ["rewards.videos.read", "rewards.rules.read", "rewards.ledger.read", "coupons.read"], children: [
    { label: "Video review", href: "/admin/rewards/videos", permission: "rewards.videos.review" },
    { label: "Rules & Tiers", href: "/admin/rewards/rules", permission: "rewards.rules.read" },
    { label: "Points Ledger", href: "/admin/rewards/ledger", permission: "rewards.ledger.read" },
    { label: "Coupons", href: "/admin/rewards/coupons", permission: "coupons.read" },
  ] },
  { label: "SEO", href: "/admin/seo", permission: "seo.write" },
  { label: "Settings", href: "/admin/settings", permission: "settings.read", children: [
    { label: "Business settings", href: "/admin/settings", permission: "settings.read" },
    { label: "Policies", href: "/admin/settings/policies", permission: "cms.read" },
  ] },
  { label: "Security", href: "/admin/security/staff", permission: "staff.read", children: [
    { label: "Staff", href: "/admin/security/staff", permission: "staff.read" },
    { label: "Roles & permissions", href: "/admin/security/roles", permission: "roles.write" },
    { label: "Audit log", href: "/admin/security/audit", permission: "audit.read" },
    { label: "Your sessions", href: "/admin/security/sessions", permission: "staff.read" },
  ] },
] satisfies readonly AdminNavigationDefinition[];

function hasPermission(permission: Permission | readonly Permission[], allowed: ReadonlySet<Permission>) {
  return typeof permission === "string" ? allowed.has(permission) : permission.some((key) => allowed.has(key));
}

export function filterAdminNavigation(items: readonly AdminNavigationDefinition[], allowed: ReadonlySet<Permission>): AdminNavigationDefinition[] {
  return items.flatMap((item) => {
    const children = item.children ? filterAdminNavigation(item.children, allowed) : undefined;
    if (item.children && !children?.length) return [];
    if (!item.children && !hasPermission(item.permission, allowed)) return [];
    return [{ ...item, ...(children ? { children } : {}) }];
  });
}
