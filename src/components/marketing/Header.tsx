import Link from "next/link";

import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";
import { PublicNavigation } from "@/components/marketing/PublicNavigation";
import { getSession } from "@/server/auth";
import { getPublicSettings } from "@/server/services/public-content";

export async function Header() {
  const [settings, session] = await Promise.all([getPublicSettings(), getSession()]);
  return (
    <header className="bg-cream-50/95 text-forest-900 sticky top-0 z-40 border-b border-forest-900/10 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="group flex min-h-11 shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500">
          <span className="bg-forest-700 text-turmeric-500 grid size-10 place-items-center rounded-full font-heading text-xl">C</span>
          <span className="leading-tight whitespace-nowrap">
            <span className="block font-heading text-lg">Chawan Farms</span>
            <span className="text-mist-500 block max-w-24 truncate text-[9px] font-semibold tracking-[0.13em] uppercase">Agri-Tourism Centre</span>
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <PublicNavigation isSignedIn={Boolean(session)} phone={settings.phones[0]} whatsappNumber={settings.whatsappNumber} whatsappMessage={settings.whatsappMessage} />
        </div>
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          {settings.phones[0] ? <CallButton number={settings.phones[0]} aria-label={`Call ${settings.phones[0]}`} title={settings.phones[0]} className="text-mist-500 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500"><span className="hidden 2xl:inline">{settings.phones[0]}</span></CallButton> : null}
          {settings.whatsappNumber ? <WhatsAppButton number={settings.whatsappNumber} message={settings.whatsappMessage} aria-label="Chat on WhatsApp" title="Chat on WhatsApp" className="text-mist-500 hidden min-h-11 items-center gap-1 rounded-lg px-2 text-xs hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500 2xl:inline-flex" /> : null}
        </div>
        <Link href="/book" className="bg-turmeric-500 text-ink-900 inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 sm:px-4">
          <span className="sm:hidden">Book</span><span className="hidden sm:inline">Plan your stay</span>
        </Link>
      </div>
    </header>
  );
}
