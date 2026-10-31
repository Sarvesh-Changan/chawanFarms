import Link from "next/link";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";

const defaultHeading = "Come live, experience & rediscover yourself & nature at its best";

type ClosingSettings = {
  whatsappNumber: string;
  whatsappMessage: string;
  phones?: string[];
};

export function ClosingCta({ heading, body, settings }: { heading?: string; body?: string; settings: ClosingSettings }) {
  return <section id="booking" className="bg-laterite-600 text-cream-50 relative isolate overflow-hidden">
    <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-[-8rem] size-[26rem] rounded-full bg-turmeric-500/20 blur-3xl" />
    <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-8 sm:py-20 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-24">
      <div className="max-w-3xl"><p className="text-paddy-300 text-xs font-semibold tracking-[0.2em] uppercase">Plan your visit</p><h2 className="font-heading mt-3 text-[clamp(2.5rem,7vw,5rem)] leading-[1]">{heading || defaultHeading}</h2>{body ? <SafeHtml html={body} className="text-cream-50/85 mt-4 max-w-xl leading-7" /> : null}</div>
      <div className="flex flex-wrap gap-3"><Link href="/book" className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold transition-[transform,background-color] duration-150 ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Plan your stay</Link>{settings.whatsappNumber ? <WhatsAppButton number={settings.whatsappNumber} message={settings.whatsappMessage} className="border-cream-50/60 text-cream-50 inline-flex min-h-12 items-center justify-center rounded-full border px-5 font-semibold transition-colors duration-150 hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Chat on WhatsApp</WhatsAppButton> : null}{settings.phones?.[0] ? <CallButton number={settings.phones[0]} className="text-cream-50 inline-flex min-h-12 items-center justify-center rounded-full px-3 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Call</CallButton> : null}</div>
    </div>
  </section>;
}
