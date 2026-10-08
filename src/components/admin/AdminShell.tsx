"use client";

import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { StaffPrincipal } from "@/server/authz";

export type AdminNavigationItem = { label: string; href: string; permission: string | readonly string[]; children?: AdminNavigationItem[] };

function NavigationLinks({ items, currentPath }: { items: AdminNavigationItem[]; currentPath: string }) {
  return <nav aria-label="Admin sections" className="grid gap-1">{items.map(({ label, href, children }) => {
    const Icon = label === "Dashboard" ? LayoutDashboard : ArrowUpRight;
    const active = href === "/admin" ? currentPath === href : currentPath === href || currentPath.startsWith(`${href}/`);
    return <div key={href}><Link href={href} aria-current={active && !children?.length ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${active ? "bg-forest-900 text-cream-50" : "text-foreground hover:bg-muted"}`}><Icon aria-hidden className="size-4" />{label}</Link>{active && children?.length ? <div className="ml-4 grid gap-1 border-l border-border py-1 pl-3">{children.map((child) => { const selected = currentPath === child.href || currentPath.startsWith(`${child.href}/`); return <Link key={child.href} href={child.href} aria-current={selected ? "page" : undefined} className={`flex min-h-10 items-center rounded-lg px-3 text-xs ${selected ? "bg-muted font-semibold text-forest-900" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{child.label}</Link>; })}</div> : null}</div>;
  })}</nav>;
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  return <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link href="/admin" className="hover:text-foreground">Admin</Link>{segments.slice(1).map((segment, index) => {
    const href = `/admin/${segments.slice(1, index + 2).join("/")}`;
    const label = segment.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const last = index === segments.length - 2;
    return <span key={`${segment}-${index}`} className="flex items-center gap-2"><span aria-hidden>›</span>{last ? <span aria-current="page" className="text-foreground">{label}</span> : <Link href={href} className="hover:text-foreground">{label}</Link>}</span>;
  })}</nav>;
}

export function AdminShell({ children, items, staff, displayName }: { children: ReactNode; items: AdminNavigationItem[]; staff: StaffPrincipal; displayName: string }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
    <aside className="hidden border-r border-border/70 bg-card/70 p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
      <Link href="/admin" className="mb-8 block rounded-xl bg-forest-900 px-4 py-4 text-cream-50"><span className="block font-heading text-xl">Chawan Farms</span><span className="mt-1 block text-xs text-cream-50/70">Admin workspace</span></Link>
      <NavigationLinks items={items} currentPath={pathname} />
      <div className="mt-8 border-t border-border/70 pt-4"><p className="truncate text-sm font-semibold">{displayName}</p><p className="mt-1 text-xs text-muted-foreground">{staff.roleNames.join(" · ")}</p></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-border/70 bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <details className="relative lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-border px-3 text-sm font-medium">Menu</summary>
            <div className="absolute top-12 left-0 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 shadow-lg"><NavigationLinks items={items} currentPath={pathname} /></div>
          </details>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-forest-900">Admin workspace</p><p className="hidden truncate text-xs text-muted-foreground sm:block">Farm operations and content management</p></div>
        </div>
        <Button asChild variant="outline" size="sm"><Link href="/">View site <ArrowUpRight aria-hidden /></Link></Button>
      </header>
      <main className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <Breadcrumbs pathname={pathname} />
        {!staff.twoFactorEnabled && (staff.roleNames.includes("Super Admin") || staff.roleNames.includes("Owner/Manager")) ? <div role="status" className="mb-5 flex flex-col gap-2 rounded-xl border border-laterite-600/30 bg-laterite-600/5 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm">Set up an authenticator to unlock protected admin features.</p><Button asChild size="sm"><Link href="/admin/security/two-factor">Set up two-factor</Link></Button></div> : null}
        {children}
      </main>
    </div>
  </div>;
}
