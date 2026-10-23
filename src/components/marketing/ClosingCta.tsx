import { SafeHtml } from "@/components/admin/SafeHtml";
import { WhatsAppButton } from "@/components/marketing/ContactButtons";

const defaultHeading = "Come live, experience & rediscover yourself & nature at its best";

type ClosingSettings = {
  whatsappNumber: string;
  whatsappMessage: string;
};

export function ClosingCta({ heading, body, settings }: { heading?: string; body?: string; settings: ClosingSettings }) {
  return <section id="booking" className="bg-laterite-600 text-cream-50 relative isolate overflow-hidden"><div aria-hidden="true" className="closing-cta-effect bg-turmeric-500/20 pointer-events-none absolute -top-32 right-[-8rem] size-[26rem] rounded-full blur-3xl"/><div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-28"><div className="max-w-3xl"><p className="text-paddy-300 text-xs font-semibold tracking-[0.2em] uppercase">Make some space</p><h2 className="font-heading mt-3 text-[clamp(2.5rem,7vw,5rem)] leading-[1]">{heading || defaultHeading}</h2>{body ? <SafeHtml html={body} className="text-cream-50/80 mt-4 max-w-xl leading-7"/> : null}</div><div className="flex flex-col gap-3 sm:flex-row"><a href="/book" className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Plan your stay</a>{settings.whatsappNumber ? <WhatsAppButton number={settings.whatsappNumber} message={settings.whatsappMessage} className="border-cream-50/50 text-cream-50 inline-flex min-h-12 items-center justify-center rounded-lg border px-5 font-semibold hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Chat on WhatsApp</WhatsAppButton> : null}</div></div></section>;
}
