import { Check } from "lucide-react";

import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CldImage } from "@/components/media/CldImage";
import type { PublicHomeData } from "@/server/services/public-content";

type Content = Record<string, unknown>;
type NatureSection = { content: unknown };
type GalleryItem = PublicHomeData["gallery"][number];

const approvedFeatureLabels = [
  "Morning and evening tea",
  "Breakfast",
  "Lunch and dinner (veg/non-veg)",
  "Open dining area",
  "Swimming in the river and small tank",
  "Volleyball",
  "Badminton",
  "Carrom",
  "Cricket",
  "Archery",
  "Karaoke system",
  "Night campfire",
  "Mountain trek",
  "White-water river rafting",
  "Jungle trail",
  "Slide shows",
  "Star gazing",
  "Fishing",
  "Bullock cart at extra cost with prior notice",
] as const;

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Content : {};
}

function localized(value: unknown): string {
  const english = record(value).en;
  return typeof english === "string" ? english : "";
}

function cmsLabels(content: Content): string[] {
  if (!Array.isArray(content.items)) return [];
  return content.items.flatMap((item) => {
    const label = localized(record(item).title);
    return label ? [label] : [];
  });
}

function mosaicClass(index: number): string {
  switch (index) {
    case 0: return "row-span-2 aspect-[4/5] sm:aspect-auto";
    case 1: return "aspect-[4/3]";
    case 2: return "aspect-square";
    case 3: return "aspect-[3/4]";
    default: return "aspect-[16/10]";
  }
}

function ImageMosaic({ gallery, cloudName }: { gallery: readonly GalleryItem[]; cloudName: string }) {
  const photos = gallery.filter((item) => item.media.kind === "IMAGE").slice(0, 5);
  if (photos.length < 3) return null;
  return <div aria-label="Published farm photos" className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((item, index) => <div key={item.id} className={`nature-mosaic-reveal group relative overflow-hidden rounded-[var(--radius-card)] bg-clay-100 ${index === 0 ? "col-span-2 sm:col-span-1" : ""} ${mosaicClass(index)}`} style={{ animationDelay: `${index * 80}ms` }}><CldImage cloudName={cloudName} publicId={item.media.publicId} alt={localized(item.media.altText)} fill sizes="(min-width: 1024px) 38vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-[var(--motion-duration-ui)] ease-[var(--motion-ease-standard)] group-hover:scale-[1.03] motion-reduce:transform-none"/></div>)}</div>;
}

export function NatureFeature({ section, gallery, cloudName }: { section: NatureSection; gallery: readonly GalleryItem[]; cloudName: string }) {
  const content = record(section.content);
  const labels = cmsLabels(content);
  const heading = localized(content.heading) || "Live with the nature";
  const description = localized(content.body) || "Imagine a place where time slows down.";
  const featureLabels = labels.length ? labels : approvedFeatureLabels;

  return <section id="nature" className="bg-cream-50"><div className="mx-auto grid max-w-7xl gap-12 px-4 py-[var(--space-section-lg)] sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-12"><div><SectionHeading eyebrow="The farm experience" title={heading} description={description}/><ul aria-label="Farm experiences and facilities" className="mt-8 grid gap-3 sm:grid-cols-2">{featureLabels.map((label) => <li key={label} className="text-forest-900 flex items-start gap-3 text-sm leading-6"><Check aria-hidden="true" className="text-laterite-600 mt-1 size-4 shrink-0"/><span>{label}</span></li>)}</ul><p className="text-mist-500 mt-6 text-sm leading-6">Optional activities are subject to conditions and availability.</p></div><ImageMosaic gallery={gallery} cloudName={cloudName}/></div></section>;
}
