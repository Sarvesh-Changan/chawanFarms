"use client";

import { ArrowLeft, Bell, Bookmark, Clapperboard, Gift, Home, LockKeyhole, ReceiptText, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CustomerLogoutButton } from "@/components/account/CustomerLogoutButton";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/account", label: "Overview", icon: Home },
  { href: "/account/bookings", label: "Bookings & Enquiries", icon: ReceiptText },
  { href: "/account/rewards", label: "Rewards", icon: Gift },
  { href: "/account/coupons", label: "Coupons", icon: WalletCards },
  { href: "/account/videos", label: "My Videos", icon: Clapperboard },
  { href: "/account/favourites", label: "Favourites", icon: Bookmark },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/profile", label: "Profile", icon: UserRound },
  { href: "/account/privacy", label: "Privacy", icon: LockKeyhole },
] as const;

function active(href: string, pathname: string): boolean {
  return href === "/account" ? pathname === href : pathname.startsWith(href);
}

export function AccountNav() {
  const pathname = usePathname();
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border/70 bg-card/70 px-4 py-6 lg:flex">
        <div>
          <p className="px-3 text-xs font-semibold tracking-[0.18em] text-laterite-600 uppercase">Your farm account</p>
          <Button asChild variant="outline" className="mt-4 w-full justify-start">
            <Link href="/" aria-label="Back to website home"><ArrowLeft aria-hidden="true" />Back to website</Link>
          </Button>
          <nav aria-label="Account navigation" className="mt-5 grid gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={active(href, pathname) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${active(href, pathname) ? "bg-forest-700 text-cream-50" : "text-foreground hover:bg-muted"}`}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-border/70 pt-4">
          <CustomerLogoutButton className="w-full justify-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive" />
        </div>
      </aside>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border/70 bg-card/95 px-4 py-2 backdrop-blur lg:hidden">
        <Button asChild variant="outline" size="sm" aria-label="Back to website" className="justify-start">
          <Link href="/"><ArrowLeft aria-hidden="true" />Back to website</Link>
        </Button>
        <CustomerLogoutButton size="sm" variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" />
      </header>
      <nav aria-label="Mobile account navigation" className="fixed right-0 bottom-0 left-0 z-20 flex overflow-x-auto border-t border-border/70 bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur lg:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href, pathname) ? "page" : undefined} className={`flex min-h-16 min-w-20 flex-1 flex-col items-center justify-center gap-1 text-[0.65rem] ${active(href, pathname) ? "font-semibold text-forest-700" : "text-muted-foreground"}`}>
            <Icon aria-hidden="true" className="size-5" />
            <span>{label === "Bookings & Enquiries" ? "Bookings" : label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export const accountLinks = links;
