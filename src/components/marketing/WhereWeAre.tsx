import { ExternalLink, MapPin, Phone } from "lucide-react";

import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import type { PublicHomeData, PublicMedia } from "@/server/services/public-content";

type Content = Record<string, unknown>;
type LocationSection = { content: unknown };
type LocationSettings = PublicHomeData["settings"];

const defaultLocationCopy = "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra";

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Content : {};
}

function localized(value: unknown): string {
  const english = record(value).en;
  return typeof english === "string" ? english : "";
}

function StaticMap({ media }: { media: PublicMedia | null }) {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (media && cloudName) {
    return <div className="relative min-h-72 overflow-hidden rounded-[var(--radius-card)] bg-clay-100 lg:min-h-full"><CldImage cloudName={cloudName} publicId={media.publicId} resourceType={media.kind === "VIDEO" ? "video" : "image"} alt={localized(media.altText)} focalX={media.focalX} focalY={media.focalY} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover"/></div>;
  }
  return <div className="relative min-h-72 overflow-hidden rounded-[var(--radius-card)] border border-forest-900/10 bg-clay-100 lg:min-h-full" aria-label="Location map preview" role="img"><div className="absolute inset-0 opacity-45 [background-image:linear-gradient(28deg,transparent_47%,theme(colors.forest.900/20)_48%,theme(colors.forest.900/20)_50%,transparent_51%),linear-gradient(112deg,transparent_47%,theme(colors.laterite.600/25)_48%,theme(colors.laterite.600/25)_50%,transparent_51%),linear-gradient(theme(colors.cream.50)_1px,transparent_1px),linear-gradient(90deg,theme(colors.cream.50)_1px,transparent_1px)] [background-size:100%_100%,100%_100%,34px_34px,34px_34px]"/><div className="bg-laterite-600 text-cream-50 absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg"><MapPin aria-hidden="true" className="size-5"/></div><p className="text-forest-900 absolute right-5 bottom-5 rounded-full bg-cream-50/90 px-3 py-1 text-xs font-semibold">Location map</p></div>;
}

export function WhereWeAre({ section, settings, media = null }: { section: LocationSection; settings: LocationSettings; media?: PublicMedia | null }) {
  const content = record(section.content);
  const heading = localized(content.heading) || defaultLocationCopy;
  const body = localized(content.body) || defaultLocationCopy;
  const mapHref = settings.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}` : "";

  return <section id="find-us" className="bg-cream-50"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-[var(--space-section-md)] sm:px-8 lg:grid-cols-2 lg:items-stretch lg:gap-14 lg:px-12 lg:py-[var(--space-section-lg)]"><div className="flex flex-col justify-center"><SectionHeading eyebrow="Where we are" title={heading} description={body}/><div className="mt-8 grid gap-4 text-sm leading-6">{settings.address ? <div className="flex gap-3"><MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-laterite-600"/><address className="not-italic">{settings.address}</address></div> : null}{settings.phones.length ? <div className="grid gap-2">{settings.phones.map((phone) => <a key={phone} href={`tel:${phone}`} className="text-forest-700 inline-flex min-h-11 items-center gap-3 font-semibold hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500"><Phone aria-hidden="true" className="size-4"/>{phone}</a>)}</div> : null}{mapHref ? <a href={mapHref} target="_blank" rel="noopener noreferrer" className="bg-forest-700 text-cream-50 inline-flex min-h-12 w-fit items-center gap-2 rounded-lg px-5 text-sm font-semibold hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Open in Google Maps <ExternalLink aria-hidden="true" className="size-4"/></a> : null}</div></div><StaticMap media={media}/></div></section>;
}
