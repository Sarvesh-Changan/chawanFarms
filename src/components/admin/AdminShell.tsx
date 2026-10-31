"use client";

import {
  ArrowUpRight,
  Award,
  BedDouble,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Sparkles,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";

import { AdminInactivityTracker } from "@/components/admin/AdminInactivityTracker";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { Button } from "@/components/ui/button";
import type { StaffPrincipal } from "@/server/authz";

export type AdminNavigationItem = {
  label: string;
  href: string;
  permission: string | readonly string[];
  children?: readonly AdminNavigationItem[];
};

const NAV_ICONS = new Map<
  string,
  ComponentType<{
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>
>([
  ["Dashboard", LayoutDashboard],
  ["Activity", Sparkles],
  ["Stories", BookOpen],
  ["Gallery", ImageIcon],
  ["Menu", UtensilsCrossed],
  ["FAQ", HelpCircle],
  ["Packages", Package],
  ["Accommodation", BedDouble],
  ["Bookings", CalendarCheck],
  ["Enquiries", MessageSquare],
  ["Leads", Users],
  ["Rewards", Award],
  ["Settings", Settings],
  ["Security", Shield],
]);

function navIconFor(
  label: string,
): ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}> {
  return NAV_ICONS.get(label) ?? ArrowUpRight;
}

function NavigationLinks({
  items,
  currentPath,
}: {
  items: AdminNavigationItem[];
  currentPath: string;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (href: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <nav aria-label="Admin sections" className="grid gap-1">
      {items.map(({ label, href, children }) => {
        const Icon = navIconFor(label);
        const hasChildren = Boolean(children?.length);

        const isChildActive = Boolean(
          children?.some(
            (child) =>
              currentPath === child.href ||
              currentPath.startsWith(`${child.href}/`),
          ),
        );
        const isSelfActive =
          href === "/admin"
            ? currentPath === href
            : currentPath === href || currentPath.startsWith(`${href}/`);
        const active = isSelfActive || isChildActive;

        const isOpen = openGroups.has(href) ? true : active;

        return (
          <div key={href} className="grid gap-1">
            {hasChildren ? (
              <div
                className={`flex min-h-11 items-center justify-between rounded-lg transition-colors ${
                  active
                    ? "bg-forest-900 text-cream-50"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Link
                  href={href}
                  onClick={(e) => {
                    if (currentPath === href) {
                      e.preventDefault();
                      toggleGroup(href);
                    }
                  }}
                  className="flex flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium outline-none"
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Toggle ${label} group`}
                  aria-expanded={isOpen}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleGroup(href);
                  }}
                  className={`mr-1.5 flex size-8 items-center justify-center rounded-md transition-colors ${
                    active
                      ? "text-cream-50/80 hover:text-cream-50 hover:bg-white/10"
                      : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                  }`}
                >
                  <ChevronDown
                    aria-hidden
                    className={`size-4 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>
              </div>
            ) : (
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-forest-900 text-cream-50"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            )}

            {hasChildren && isOpen && children ? (
              <div className="border-border ml-4 grid gap-1 border-l py-1 pl-3">
                {children.map((child) => {
                  const selected =
                    currentPath === child.href ||
                    (child.href !== href &&
                      currentPath.startsWith(`${child.href}/`)) ||
                    (child.href === href &&
                      currentPath.startsWith(`${child.href}/`) &&
                      !children.some(
                        (other) =>
                          other.href !== href &&
                          (currentPath === other.href ||
                            currentPath.startsWith(`${other.href}/`)),
                      ));

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      aria-current={selected ? "page" : undefined}
                      className={`flex min-h-10 items-center rounded-lg px-3 text-xs transition-colors ${
                        selected
                          ? "bg-muted text-forest-900 font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground mb-5 flex flex-wrap items-center gap-2 text-xs"
    >
      <Link href="/admin" className="hover:text-foreground">
        Admin
      </Link>
      {segments.slice(1).map((segment, index) => {
        const href = `/admin/${segments.slice(1, index + 2).join("/")}`;
        const label = segment
          .replaceAll("-", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
        const last = index === segments.length - 2;
        return (
          <span key={`${segment}-${index}`} className="flex items-center gap-2">
            <span aria-hidden>›</span>
            {last ? (
              <span aria-current="page" className="text-foreground">
                {label}
              </span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  children,
  items,
  staff,
  displayName,
}: {
  children: ReactNode;
  items: AdminNavigationItem[];
  staff: StaffPrincipal;
  displayName: string;
}) {
  const pathname = usePathname();
  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <AdminInactivityTracker />
      <aside className="border-border/70 bg-card/70 hidden border-r p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <Link
          href="/admin"
          className="bg-forest-900 text-cream-50 mb-8 block rounded-xl px-4 py-4"
        >
          <span className="font-heading block text-xl">Chawan Farms</span>
          <span className="text-cream-50/70 mt-1 block text-xs">
            Admin workspace
          </span>
        </Link>
        <NavigationLinks items={items} currentPath={pathname} />
        <div className="border-border/70 mt-8 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {staff.roleNames.join(" · ")}
              </p>
            </div>
            <AdminLogoutButton
              variant="ghost"
              size="icon-sm"
              showLabel={false}
            />
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-border/70 bg-background/95 sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <details className="relative lg:hidden">
              <summary className="border-border flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-3 text-sm font-medium">
                Menu
              </summary>
              <div className="border-border bg-card absolute top-12 left-0 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border p-3 shadow-lg">
                <NavigationLinks items={items} currentPath={pathname} />
                <div className="border-border/70 mt-4 border-t pt-3">
                  <AdminLogoutButton className="w-full justify-start" />
                </div>
              </div>
            </details>
            <div className="min-w-0">
              <p className="text-forest-900 truncate text-sm font-semibold">
                Admin workspace
              </p>
              <p className="text-muted-foreground hidden truncate text-xs sm:block">
                Farm operations and content management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                View site <ArrowUpRight aria-hidden />
              </Link>
            </Button>
            <AdminLogoutButton variant="outline" size="sm" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <Breadcrumbs pathname={pathname} />
          {children}
        </main>
      </div>
    </div>
  );
}
