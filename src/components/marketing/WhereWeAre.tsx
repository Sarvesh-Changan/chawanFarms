import { MapPin, Phone } from "lucide-react";

import { SectionHeading } from "@/components/marketing/SectionHeading";
import type { PublicHomeData } from "@/server/services/public-content";

type Content = Record<string, unknown>;
type LocationSection = { content: unknown };
type LocationSettings = PublicHomeData["settings"];

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Content : {};
}

function localized(value: unknown): string {
  const english = record(value).en;
  return typeof english === "string" ? english : "";
}

export function WhereWeAre({ section, settings }: { section: LocationSection; settings: LocationSettings }) {
  if (!settings.address && !settings.phones.length) return null;

  const content = record(section.content);
  const heading = localized(content.heading) || "Find the farm";
  const body = localized(content.body);
  const mapsHref = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : null;

  return (
    <section id="find-us" aria-labelledby="find-us-heading" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-4 py-[var(--space-section-md)] sm:px-8 lg:px-12 lg:py-[var(--space-section-lg)]">
        <div className="flex flex-col justify-center">
          <SectionHeading id="find-us-heading" eyebrow="Where we are" title={heading} description={body || undefined} />
          <div className="mt-6 grid gap-3 text-sm leading-6">
            {settings.address ? <div className="flex gap-3"><MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-laterite-600" /><address className="not-italic">{settings.address}</address></div> : null}
            {settings.phones.length ? <div className="grid gap-2">{settings.phones.map((phone) => <a key={phone} href={`tel:${phone}`} className="text-forest-700 inline-flex min-h-11 items-center gap-3 rounded-md font-semibold transition-colors duration-[var(--motion-duration-fast)] hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"><Phone aria-hidden="true" className="size-4" />{phone}</a>)}</div> : null}
            {mapsHref ? <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="bg-forest-700 text-cream-50 inline-flex min-h-12 w-fit items-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Search this address in Google Maps</a> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
