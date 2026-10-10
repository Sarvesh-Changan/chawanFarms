import Link from "next/link";

import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";
import { getPublicSettings } from "@/server/services/public-content";

export async function Header() {
  const settings = await getPublicSettings();
  return (
    <header className="bg-cream-50/95 text-forest-900 sticky top-0 z-40 border-b border-forest-900/10 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="group flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500">
          <span className="bg-forest-700 text-turmeric-500 grid size-10 place-items-center rounded-full font-heading text-xl">C</span>
          <span className="leading-tight">
            <span className="block font-heading text-lg">Chawan Farms</span>
            <span className="text-mist-500 block text-[10px] font-semibold tracking-[0.17em] uppercase">Agri-Tourism Centre</span>
          </span>
        </Link>
        {settings.address ? <p className="text-mist-500 hidden max-w-xs truncate text-xs xl:block" title={settings.address}>{settings.address}</p> : null}
        <nav aria-label="Primary navigation" className="hidden items-center gap-6 text-sm font-medium lg:flex">
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/#experiences">Experiences</Link>
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/packages">Packages</Link>
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/#gallery">Gallery</Link>
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/#location">Find us</Link>
        </nav>
        <div className="hidden items-center gap-3 xl:flex">
          {settings.phones[0] ? <CallButton number={settings.phones[0]} className="text-mist-500 inline-flex min-h-11 items-center gap-1 text-xs hover:text-laterite-600" /> : null}
          {settings.whatsappNumber ? <WhatsAppButton number={settings.whatsappNumber} message={settings.whatsappMessage} className="text-mist-500 inline-flex min-h-11 items-center gap-1 text-xs hover:text-laterite-600" /> : null}
        </div>
        <Link href="/book" className="bg-turmeric-500 text-ink-900 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">
          Book / Enquire
        </Link>
      </div>
    </header>
  );
}
