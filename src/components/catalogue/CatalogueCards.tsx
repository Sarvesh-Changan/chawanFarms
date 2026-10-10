import Link from "next/link";

import { FavouriteButton } from "@/components/catalogue/FavouriteButton";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { formatINR } from "@/lib/money";
import type { PublicAccommodation, PublicActivity, PublicExperience, PublicPackage } from "@/server/services/public-content";

function localized(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function CardImage({ media, alt }: { media: PublicAccommodation["heroMedia"] | PublicActivity["heroMedia"] | PublicExperience["heroMedia"] | PublicPackage["heroMedia"]; alt: string }) {
  if (!media || !env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) return <div className="bg-clay-100 size-full" aria-hidden="true"/>;
  return <CldImage cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME} publicId={media.publicId} resourceType={media.kind === "VIDEO" ? "video" : "image"} alt={alt || localized(media.altText)} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover"/>;
}

export function PackageCard({ item }: { item: PublicPackage }) {
  const adultRates = item.rates.filter((rate) => rate.audience === "ADULT");
  const from = adultRates.length ? Math.min(...adultRates.map((rate) => rate.amountPaise)) : null;
  return <article className="bg-cream-50 border-forest-900/10 relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm"><div className="bg-clay-100 relative aspect-[4/3]"><CardImage media={item.heroMedia} alt={localized(item.name)} />{item.code ? <span className="bg-cream-50 text-forest-700 absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold">{item.code}</span> : null}<div className="absolute top-3 right-3"><FavouriteButton entityType="package" entityId={item.id} label={localized(item.name)}/></div></div><div className="flex flex-1 flex-col p-5 sm:p-6"><h2 className="font-heading text-forest-900 text-2xl leading-tight"><Link href={`/packages/${item.slug}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{localized(item.name)}</Link></h2>{localized(item.summary) || localized(item.description) ? <p className="text-mist-500 mt-2 text-sm leading-6">{localized(item.summary) || localized(item.description)}</p> : null}<p className="text-forest-900 mt-5 font-heading text-2xl">{from === null ? "Contact us" : <>from {formatINR(from)} <span className="text-mist-500 font-sans text-sm font-normal">per person</span></>}</p>{item.minGuests ? <p className="text-mist-500 mt-2 text-xs">Minimum group: {item.minGuests}{item.maxGuests ? `–${item.maxGuests}` : ""} persons</p> : null}<Link href={`/packages/${item.slug}`} className="bg-forest-700 text-cream-50 mt-6 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">View package</Link></div></article>;
}

export function AccommodationCard({ item }: { item: PublicAccommodation }) {
  return <article className="bg-cream-50 border-forest-900/10 overflow-hidden rounded-2xl border"><div className="bg-clay-100 relative aspect-[16/10]"><CardImage media={item.heroMedia} alt={localized(item.name)}/></div><div className="p-5 sm:p-6"><h2 className="font-heading text-forest-900 text-2xl"><Link href={`/accommodation/${item.slug}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{localized(item.name)}</Link></h2>{localized(item.summary) || localized(item.description) ? <p className="text-mist-500 mt-3 text-sm leading-6">{localized(item.summary) || localized(item.description)}</p> : null}<Link href={`/accommodation/${item.slug}`} className="text-forest-700 mt-5 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">View accommodation →</Link></div></article>;
}

export function ExperienceCard({ item }: { item: PublicExperience }) {
  return <article className="bg-forest-900 text-cream-50 relative overflow-hidden rounded-[1.5rem] p-6 sm:p-7"><div className="absolute inset-0 opacity-35"><CardImage media={item.heroMedia} alt={localized(item.title)}/></div><div className="from-forest-900/95 absolute inset-0 bg-gradient-to-t via-forest-900/55 to-transparent"/><div className="relative flex min-h-64 flex-col justify-end"><div className="absolute top-0 right-0"><FavouriteButton entityType="experience" entityId={item.id} label={localized(item.title)}/></div><h2 className="font-heading pr-12 text-3xl leading-tight">{localized(item.title)}</h2>{localized(item.summary) ? <p className="text-cream-50/80 mt-3 max-w-sm text-sm leading-6">{localized(item.summary)}</p> : null}<Link href={`/experiences/${item.slug}`} className="text-turmeric-500 mt-5 inline-flex min-h-11 w-fit items-center rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">Explore experience →</Link></div></article>;
}

export function ActivityCard({ item }: { item: PublicActivity }) {
  return <article className="bg-cream-50 border-forest-900/10 relative overflow-hidden rounded-2xl border"><div className="bg-clay-100 relative aspect-[4/3]"><CardImage media={item.heroMedia} alt={localized(item.name)}/>{item.isExtraCost ? <span className="bg-turmeric-500 text-ink-900 absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Extra cost</span> : null}<div className="absolute top-3 right-3"><FavouriteButton entityType="activity" entityId={item.id} label={localized(item.name)}/></div></div><div className="p-4"><h2 className="font-heading text-forest-900 text-xl"><Link href={`/activities/${item.slug}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{localized(item.name)}</Link></h2>{localized(item.conditionsNote) ? <p className="text-mist-500 mt-2 text-xs leading-5">{localized(item.conditionsNote)}</p> : null}</div></article>;
}
