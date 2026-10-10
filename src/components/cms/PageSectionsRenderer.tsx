import Link from "next/link";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import type { PageSectionType } from "@/config/page-builder";

type PublicSection = { type: string; content: unknown; isVisible: boolean };
type PublicPage = { title: unknown; sections: PublicSection[]; images: { id: string; publicId: string; altText: unknown; format: string | null }[] };
type Dictionary = Record<string, unknown>;

function record(value: unknown): Dictionary {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Dictionary : {};
}
function localized(value: unknown): string {
  const text = record(value).en;
  return typeof text === "string" ? text : "";
}
function headingOf(type: PageSectionType, content: Dictionary): string {
  if (type === "hero") return localized(content.heading);
  return localized(content.heading);
}
function sectionHref(type: PageSectionType): string | null {
  switch (type) {
    case "experiences-grid": return "/experiences";
    case "accommodation": return "/accommodation";
    case "packages": return "/packages";
    case "food": return "/food";
    case "activities": return "/activities";
    case "gallery": return "/gallery";
    case "stories": return "/stories";
    case "location": return "/contact";
    default: return null;
  }
}

export function PageSectionsRenderer({ page, preview = false }: { page: PublicPage; preview?: boolean }) {
  const images = new Map(page.images.map((image) => [image.id, image]));
  const title = localized(page.title);
  return <main className="min-h-[50vh]">
    {preview ? <p className="bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-950">Unpublished page preview</p> : null}
    {page.sections.filter((section) => section.isVisible).map((section, index) => {
      if (!isPageSectionType(section.type)) return null;
      const content = record(section.content);
      const heading = headingOf(section.type, content);
      const body = localized(content.body);
      const mediaId = typeof content.imageMediaId === "string" ? content.imageMediaId : "";
      const media = images.get(mediaId);
      const items = Array.isArray(content.items) ? content.items.map(record) : [];
      const hero = section.type === "hero";
      return <section key={`${section.type}-${index}`} className={hero ? "bg-forest-900 text-cream-50" : index % 2 ? "bg-clay-100" : "bg-background"}>
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center lg:px-12">
          <div className="space-y-5">
            {localized(content.eyebrow) ? <p className="text-sm font-semibold uppercase tracking-[0.18em] text-laterite-600">{localized(content.eyebrow)}</p> : null}
            {heading ? <h1 className="font-heading text-4xl leading-tight sm:text-5xl">{heading}</h1> : null}
            {body ? section.type === "rich-text" || section.type === "image-text" ? <SafeHtml html={body} className="prose max-w-none" /> : <p className="max-w-2xl whitespace-pre-line text-base leading-7 opacity-85">{body}</p> : null}
            {items.length ? <div className="grid gap-4 sm:grid-cols-2">{items.map((item, itemIndex) => <article key={itemIndex} className="rounded-xl border border-current/15 p-4"><h2 className="font-heading text-xl">{localized(item.title)}</h2>{localized(item.body) ? <p className="mt-2 text-sm leading-6 opacity-80">{localized(item.body)}</p> : null}</article>)}</div> : null}
            {(() => { const href = sectionHref(section.type); return href ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-current/30 px-4 text-sm font-semibold underline-offset-4 hover:underline" href={href}>Explore {section.type.replaceAll("-", " ")}</Link> : null; })()}
            {localized(content.ctaLabel) && typeof content.ctaHref === "string" && content.ctaHref.startsWith("/") && !content.ctaHref.startsWith("//") ? <Link className="inline-flex min-h-11 items-center rounded-lg bg-turmeric-500 px-5 font-semibold text-forest-900" href={content.ctaHref}>{localized(content.ctaLabel)}</Link> : null}
          </div>
          {media ? <div className="relative min-h-64 overflow-hidden rounded-2xl bg-muted"><CldImage cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} publicId={media.publicId} alt={localized(media.altText)} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover"/></div> : null}
        </div>
      </section>;
    })}
    <span className="sr-only">{title}</span>
  </main>;
}

function isPageSectionType(value: string): value is PageSectionType {
  return ["hero", "why-chawan", "experiences-grid", "accommodation", "packages", "food", "activities", "gallery", "stories", "rewards-teaser", "location", "final-cta", "rich-text", "image-text"].includes(value);
}
