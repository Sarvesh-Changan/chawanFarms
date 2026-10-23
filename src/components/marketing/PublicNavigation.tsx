"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";
import { publicNavGroups, publicNavHome, publicNavTopLevel, type PublicNavItem } from "@/config/public-nav";

export const publicNavigation: readonly PublicNavItem[] = [publicNavHome, ...publicNavGroups.flatMap((group) => group.items), ...publicNavTopLevel];
type GroupKey = (typeof publicNavGroups)[number]["label"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, children, pathname, onClick, onKeyDown, menuItem = false, itemRef }: { href: string; children: ReactNode; pathname: string; onClick?: () => void; onKeyDown?: (event: ReactKeyboardEvent<HTMLAnchorElement>) => void; menuItem?: boolean; itemRef?: (element: HTMLAnchorElement | null) => void }) {
  const active = isActive(pathname, href);
  return <Link ref={itemRef} href={href} onClick={onClick} onKeyDown={onKeyDown} role={menuItem ? "menuitem" : undefined} aria-current={active ? "page" : undefined} className={`group/nav relative rounded-md px-2 py-3 transition-colors hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500 after:absolute after:right-2 after:bottom-1 after:left-2 after:h-0.5 after:origin-left after:scale-x-0 after:bg-turmeric-500 after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:after:scale-x-100 ${active ? "text-laterite-600 after:scale-x-100" : ""} ${menuItem ? "block px-3 py-2.5 after:hidden" : ""}`}>
    {menuItem ? <span aria-hidden="true" className="mr-2 inline-block translate-x-[-3px] opacity-0 transition duration-150 group-hover/nav:translate-x-0 group-hover/nav:opacity-100">→</span> : null}{children}
  </Link>;
}

function Dropdown({ group, pathname, openGroup, setOpenGroup }: { group: (typeof publicNavGroups)[number]; pathname: string; openGroup: GroupKey | null; setOpenGroup: (group: GroupKey | null) => void }) {
  const [trigger, panel] = [useRef<HTMLButtonElement>(null), useRef<HTMLDivElement>(null)];
  const itemRefs = useRef(new Map<number, HTMLAnchorElement>());
  const open = openGroup === group.label;
  const active = group.items.some((item) => isActive(pathname, item.href));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const scheduleOpen = () => {
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    clearTimer();
    timer.current = setTimeout(() => setOpenGroup(group.label), 100);
  };
  const scheduleClose = () => { clearTimer(); timer.current = setTimeout(() => setOpenGroup(null), 180); };
  const toggle = () => { clearTimer(); setOpenGroup(open ? null : group.label); };
  const focusItem = (index: number) => itemRefs.current.get(index)?.focus();
  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (event.key === "ArrowDown") setOpenGroup(group.label);
      else setOpenGroup(open ? null : group.label);
      if (event.key === "ArrowDown") window.setTimeout(() => focusItem(0), 0);
    } else if (event.key === "Escape") {
      setOpenGroup(null);
    } else if (event.key === "Tab") {
      setOpenGroup(null);
    }
  };
  const handleItemKeyDown = (event: ReactKeyboardEvent<HTMLAnchorElement>, index: number) => {
    if (event.key === "ArrowDown") { event.preventDefault(); focusItem((index + 1) % group.items.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); focusItem((index - 1 + group.items.length) % group.items.length); }
    if (event.key === "Escape") { event.preventDefault(); setOpenGroup(null); trigger.current?.focus(); }
    if (event.key === "Tab") setOpenGroup(null);
  };
  useEffect(() => () => clearTimer(), []);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) setOpenGroup(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, panel, setOpenGroup]);
  return <div ref={panel} className="relative" onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={`nav-${group.label.toLowerCase()}`} aria-current={active ? "page" : undefined} onClick={toggle} onKeyDown={handleTriggerKeyDown} onMouseEnter={scheduleOpen} className={`group/nav relative flex min-h-11 items-center gap-1 rounded-md px-2 py-3 transition-colors hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500 after:absolute after:right-2 after:bottom-1 after:left-2 after:h-0.5 after:origin-left after:scale-x-0 after:bg-turmeric-500 after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:after:scale-x-100 ${active ? "text-laterite-600 after:scale-x-100" : ""}`}>
      {group.label} <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? <>
      <span aria-hidden="true" className="absolute right-0 bottom-[-0.75rem] left-0 h-3" />
      <div id={`nav-${group.label.toLowerCase()}`} role="menu" aria-label={group.label} onMouseEnter={clearTimer} onMouseLeave={scheduleClose} className="bg-cream-50 absolute top-[calc(100%+0.75rem)] left-0 z-50 min-w-56 origin-top rounded-xl border border-forest-900/10 p-2 opacity-100 shadow-xl transition duration-200 ease-out motion-safe:animate-[nav-drop-in_180ms_ease-out] motion-reduce:animate-none">
        {group.items.map((item, index) => <NavLink key={item.href} {...item} pathname={pathname} menuItem onKeyDown={(event) => handleItemKeyDown(event, index)} itemRef={(element) => { if (element) itemRefs.current.set(index, element); else itemRefs.current.delete(index); }}>{item.label}</NavLink>)}
      </div>
    </> : null}
  </div>;
}

export function PublicNavigation({ isSignedIn, phone, whatsappNumber, whatsappMessage }: { isSignedIn: boolean; phone?: string; whatsappNumber?: string; whatsappMessage?: string }) {
  const pathname = usePathname() ?? "/";
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobile = () => { setMobileOpen(false); menuButtonRef.current?.focus(); };

  useEffect(() => {
    // The pathname is external navigation state; close the menu after a route transition.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
        return;
      }
      if (event.key === "Tab") {
        const focusable = Array.from(document.querySelectorAll<HTMLElement>("#mobile-navigation a, #mobile-navigation button")).filter((element) => !element.hasAttribute("disabled"));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLButtonElement>("#mobile-navigation button")?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return <>
    <nav aria-label="Primary navigation" className="hidden items-center justify-end gap-1 text-sm font-medium xl:flex">
      <NavLink {...publicNavHome} pathname={pathname}>{publicNavHome.label}</NavLink>
      {publicNavGroups.map((group) => <Dropdown key={group.label} group={group} pathname={pathname} openGroup={openGroup} setOpenGroup={setOpenGroup} />)}
      {publicNavTopLevel.map((item) => <NavLink key={item.href} {...item} pathname={pathname}>{item.label}</NavLink>)}
      <NavLink href={isSignedIn ? "/account" : "/login"} pathname={pathname}>{isSignedIn ? "Account" : "Login"}</NavLink>
    </nav>
    <button ref={menuButtonRef} type="button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen((value) => !value)} className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-forest-900/15 xl:hidden focus-visible:outline-2 focus-visible:outline-turmeric-500">
      {mobileOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
    </button>
    {mobileOpen ? <div id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Site navigation" className="bg-cream-50 fixed inset-0 z-50 overflow-y-auto p-5 xl:hidden">
      <div className="mx-auto flex max-w-7xl justify-end"><button type="button" aria-label="Close navigation menu" onClick={closeMobile} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-forest-900/15 focus-visible:outline-2 focus-visible:outline-turmeric-500"><X aria-hidden="true" className="size-5" /></button></div>
      <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl flex-col gap-1 py-8 text-2xl font-medium">
        <NavLink {...publicNavHome} pathname={pathname} onClick={() => setMobileOpen(false)}>{publicNavHome.label}</NavLink>
        {publicNavGroups.map((group) => <div key={group.label} className="mt-5"><p className="text-mist-500 px-2 text-xs font-semibold tracking-[0.2em] uppercase">{group.label}</p>{group.items.map((item) => <NavLink key={item.href} {...item} pathname={pathname} onClick={() => setMobileOpen(false)}>{item.label}</NavLink>)}</div>)}
        {publicNavTopLevel.map((item) => <NavLink key={item.href} {...item} pathname={pathname} onClick={() => setMobileOpen(false)}>{item.label}</NavLink>)}
        <NavLink href={isSignedIn ? "/account" : "/login"} pathname={pathname} onClick={() => setMobileOpen(false)}>{isSignedIn ? "Account" : "Login"}</NavLink>
        <NavLink href="/book" pathname={pathname} onClick={() => setMobileOpen(false)}>Plan your stay</NavLink>
      </nav>
      <div className="mx-auto mt-5 flex max-w-7xl gap-3 border-t border-forest-900/10 pt-5">{phone ? <CallButton number={phone} className="text-mist-500 inline-flex min-h-11 items-center gap-2 text-sm font-semibold" aria-label={`Call ${phone}`} title={phone}>Call the farm</CallButton> : null}{whatsappNumber ? <WhatsAppButton number={whatsappNumber} message={whatsappMessage} className="text-mist-500 inline-flex min-h-11 items-center gap-2 text-sm font-semibold" aria-label="Chat on WhatsApp" title="Chat on WhatsApp">WhatsApp</WhatsAppButton> : null}</div>
    </div> : null}
  </>;
}
