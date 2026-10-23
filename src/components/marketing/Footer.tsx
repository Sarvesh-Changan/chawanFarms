import Link from "next/link";

import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";
import { publicNavGroups, publicNavHome, publicNavTopLevel } from "@/config/public-nav";
import { getPublicSettings } from "@/server/services/public-content";

export async function Footer() {
  const settings = await getPublicSettings();
  return <FooterContent settings={settings}/>;
}

export function FooterContent({ settings }: { settings: Awaited<ReturnType<typeof getPublicSettings>> }) {
  return (
    <footer className="bg-forest-900 text-cream-50 px-4 py-12 pb-28 sm:px-8 lg:px-12 lg:pb-12">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p aria-label="Chawan Farms" className="font-heading text-[clamp(3.5rem,12vw,9rem)] leading-[0.8] tracking-[-0.06em]">Chawan Farms</p>
          <p className="text-cream-50/70 mt-3 max-w-sm text-sm leading-6">Come live, experience & rediscover yourself & nature at its best.</p>
        </div>
        <div>
          <p className="text-turmeric-500 text-xs font-semibold tracking-[0.18em] uppercase">Navigate</p>
          <div className="mt-3 grid gap-2 text-sm text-cream-50/80">
            <Link className="w-fit hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href={publicNavHome.href}>{publicNavHome.label}</Link>
            {publicNavGroups.flatMap((group) => group.items).map((item) => <Link key={item.href} className="w-fit hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href={item.href}>{item.label}</Link>)}
            {publicNavTopLevel.map((item) => <Link key={item.href} className="w-fit hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href={item.href}>{item.label}</Link>)}
            <Link className="w-fit hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/book">Book / Enquire</Link>
          </div>
        </div>
        {settings.address || settings.phones.length || settings.whatsappNumber ? <div>
          <p className="text-turmeric-500 text-xs font-semibold tracking-[0.18em] uppercase">Find us</p>
          {settings.address ? <address className="text-cream-50/80 mt-3 text-sm leading-6 not-italic">{settings.address}</address> : null}
          {settings.phones.length ? <div className="mt-2 grid gap-1 text-sm">
            {settings.phones.map((phone) => <CallButton className="inline-flex min-h-11 w-fit items-center gap-2 text-cream-50/80 hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" number={phone} key={phone}>{phone}</CallButton>)}
          </div> : null}
          {settings.whatsappNumber ? <WhatsAppButton number={settings.whatsappNumber} message={settings.whatsappMessage} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-cream-50/80 hover:text-turmeric-500">Message us on WhatsApp</WhatsAppButton> : null}
        </div> : null}
      </div>
      <div className="border-cream-50/15 text-cream-50/50 mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t pt-5 text-xs sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Chawan Farms</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/policies" className="hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500">Policies</Link>
          <Link href="/privacy" className="hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500">Privacy</Link>
          <Link href="/terms" className="hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500">Terms</Link>
        </div>
      </div>
      {settings.socialLinks?.length ? <nav aria-label="Social links" className="mx-auto mt-5 flex max-w-7xl flex-wrap gap-x-4 gap-y-2 text-sm text-cream-50/70">{settings.socialLinks.map((item) => <a key={`${item.label}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500">{item.label}</a>)}</nav> : null}
    </footer>
  );
}
