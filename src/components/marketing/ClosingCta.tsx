import Link from "next/link";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { WhatsAppButton } from "@/components/marketing/ContactButtons";

const defaultHeading = "Your farm stay starts here.";

type ClosingSettings = {
  whatsappNumber: string;
  whatsappMessage: string;
  phones?: string[];
};

export function ClosingCta({
  heading,
  body,
  settings,
}: {
  heading?: string;
  body?: string;
  settings: ClosingSettings;
}) {
  return (
    <section
      id="closing-cta"
      aria-labelledby="closing-cta-heading"
      className="bg-[#B4482A] text-cream-50 relative isolate overflow-hidden rounded-t-[2.5rem] sm:rounded-t-[3.5rem] -mt-8 sm:-mt-12 z-10 shadow-2xl transition-colors duration-300"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-8rem] size-[26rem] rounded-full bg-turmeric-500/15 blur-3xl"
      />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-8 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-turmeric-500/90 text-xs font-semibold tracking-[0.2em] uppercase font-mono">
            {"// PLAN YOUR VISIT"}
          </p>
          <h2
            id="closing-cta-heading"
            className="font-heading mt-3 text-[clamp(2.5rem,6.5vw,4.75rem)] leading-[1.05] tracking-tight font-normal"
          >
            {heading || defaultHeading}
          </h2>
          {body && (
            <SafeHtml
              html={body}
              className="text-cream-50/85 mt-4 max-w-xl leading-relaxed text-base"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <Link
            href="/book"
            className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-full px-7 font-semibold transition-[transform,background-color] duration-150 ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Plan your stay
          </Link>
          {settings.whatsappNumber ? (
            <WhatsAppButton
              number={settings.whatsappNumber}
              message={settings.whatsappMessage}
              className="border border-cream-50/50 text-cream-50 inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold transition-colors duration-150 hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Chat on WhatsApp
            </WhatsAppButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
