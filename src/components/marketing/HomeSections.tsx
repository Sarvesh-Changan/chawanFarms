import Link from "next/link";
import { Fragment } from "react";

import { ClosingCta } from "@/components/marketing/ClosingCta";
import { ExperienceCarousel } from "@/components/marketing/ExperienceCarousel";
import { HomeGallery, type HomeGalleryItem } from "@/components/marketing/HomeGallery";
import { HomeHero } from "@/components/marketing/HomeHero";
import { NatureFeature } from "@/components/marketing/NatureFeature";
import { RewardsTeaser } from "@/components/marketing/RewardsTeaser";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StayCards } from "@/components/marketing/StayCards";
import { WhereWeAre } from "@/components/marketing/WhereWeAre";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { mapStayPackages } from "@/lib/stay-catalogue";
import type { PublicHomeData, PublicMedia } from "@/server/services/public-content";

const sectionClass = "mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28";
export const homeSectionOrder = ["hero", "location", "experiences-grid", "why-chawan", "packages", "accommodation", "food", "activities", "gallery", "rewards-teaser", "final-cta"] as const;
type FixedSection = { content: Record<string, unknown> };

const fixedSections: Record<string, FixedSection> = {
  hero: { content: {} },
  location: { content: { heading: { en: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra" }, body: { en: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra" } } },
  "experiences-grid": { content: { heading: { en: "Horticultural farming, dairy, poultry" }, body: { en: "Organic farming" } } },
  "why-chawan": { content: { heading: { en: "Live with the nature" }, body: { en: "Imagine a place where time slows down." } } },
  packages: { content: { heading: { en: "Per person per day, one night stay" } } },
  accommodation: { content: { heading: { en: "Camping tents / Dormitory · Guest House" }, body: { en: "Lawn area only for Camp Organisers" } } },
  food: { content: { heading: { en: "Breakfast Menu" } } },
  activities: { content: { heading: { en: "Optional activities" }, body: { en: "Arranged according to prevailing conditions and availability" } } },
  gallery: { content: {} },
  "rewards-teaser": { content: {} },
  "final-cta": { content: {} },
};

function text(value: unknown): string { const english = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).en : undefined; return typeof english === "string" ? english : ""; }
function mediaAlt(media: PublicMedia): string { return text(media.altText) || "Farm photo"; }
function mediaResource(media: PublicMedia): "image" | "video" { return media.kind === "VIDEO" ? "video" : "image"; }
function CmsHeading({ content, eyebrow }: { content: Record<string, unknown>; eyebrow?: string }) { const heading = text(content.heading); const body = text(content.body); return <SectionHeading eyebrow={eyebrow} title={heading || eyebrow || ""} description={body || undefined}/>; }
function MediaImage({ media, priority = false, sizes = "(min-width: 1024px) 45vw, 100vw" }: { media: PublicMedia; priority?: boolean; sizes?: string }) { const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME; if (!cloudName) return null; return <CldImage cloudName={cloudName} publicId={media.publicId} resourceType={mediaResource(media)} alt={mediaAlt(media)} focalX={media.focalX} focalY={media.focalY} fill priority={priority} sizes={sizes} className="object-cover"/>; }

function WhySection({ section, gallery }: { section: FixedSection; gallery: PublicHomeData["gallery"] }) { return <><NatureFeature section={section} gallery={gallery} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/><ViewAllLink href="/activities" label="View all activities"/></>; }
function ExperiencesSection({ section, experiences }: { section: FixedSection; experiences: PublicHomeData["experiences"] }) { if (!experiences.length) return null; return <><ExperienceCarousel experiences={experiences.slice(0, 6)} heading={text(section.content.heading)} description={text(section.content.body)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/><ViewAllLink href="/experiences" label="View all experiences"/></>; }
function AccommodationsSection({ section, accommodations }: { section: FixedSection; accommodations: PublicHomeData["accommodations"] }) { return <section id="accommodation" className={sectionClass}><CmsHeading content={section.content} eyebrow="Accommodation" />{accommodations.length ? <div className="mt-10 grid gap-4 md:grid-cols-2">{accommodations.map((item) => <article key={item.id} className="bg-clay-100 overflow-hidden rounded-2xl"><div className="relative aspect-[16/9]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 768px) 50vw, 100vw"/> : null}<div className="from-forest-900/80 absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"/><div className="absolute right-0 bottom-0 left-0 p-5 text-cream-50 sm:p-6"><h3 className="font-heading text-2xl leading-tight">{text(item.name)}</h3>{text(item.summary) || text(item.description) ? <p className="text-cream-50/80 mt-2 text-sm leading-6">{text(item.summary) || text(item.description)}</p> : null}</div></div></article>)}</div> : <EmptyPublished label="accommodation options"/>}</section>; }
function PackagesSection({ section, packages }: { section: FixedSection; packages: PublicHomeData["packages"] }) { return <section id="packages" className="bg-cream-50"><div className={sectionClass}><CmsHeading content={section.content} eyebrow="Stay with us"/>{packages.length ? <StayCards items={mapStayPackages(packages)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/> : <EmptyPublished label="packages"/>}<ViewAllLink href="/packages" label="View all packages"/></div></section>; }
function FoodSection({ section, food }: { section: FixedSection; food: PublicHomeData["food"] }) { return <section id="food" className="bg-paddy-300/25"><div className={sectionClass}><CmsHeading content={section.content} eyebrow="Food"/>{food.length ? <div className="mt-10 grid gap-3 md:grid-cols-2">{food.map((category) => <details key={category.id} className="bg-clay-100 rounded-xl p-5" open><summary className="cursor-pointer font-semibold">{text(category.name)}</summary><ul className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm sm:grid-cols-2">{category.items.map((item) => <li className="flex gap-2" key={item.id}><span className="text-leaf-500" aria-hidden="true">•</span><span>{text(item.name)}{item.isExtraCharge ? <span className="text-mist-500"> · extra</span> : null}</span></li>)}</ul></details>)}</div> : <EmptyPublished label="food items"/>}</div></section>; }
function ActivitiesSection({ section, activities }: { section: FixedSection; activities: PublicHomeData["activities"] }) { return <section id="activities" className={sectionClass}><CmsHeading content={section.content} eyebrow="Activities"/>{activities.length ? <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{activities.map((item) => <article key={item.id} className="bg-cream-50 border-forest-900/10 overflow-hidden rounded-2xl border"><div className="bg-clay-100 relative aspect-[4/3]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"/> : null}{item.isExtraCost ? <span className="bg-turmeric-500 text-ink-900 absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Extra cost</span> : null}</div><div className="p-4"><h3 className="font-heading text-forest-900 text-xl">{text(item.name)}</h3>{text(item.conditionsNote) || text(item.priceNote) ? <p className="text-mist-500 mt-2 text-xs leading-5">{text(item.conditionsNote) || text(item.priceNote)}</p> : null}</div></article>)}</div> : <EmptyPublished label="activities"/>}</section>; }
function EmptyPublished({ label }: { label: string }) { return <p className="bg-clay-100 text-mist-500 mt-10 rounded-2xl p-8 text-center text-sm">No published {label} are available yet.</p>; }
function ViewAllLink({ href, label }: { href: string; label: string }) { return <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-8 lg:px-12"><Link href={href} className="text-forest-700 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{label} →</Link></div>; }

export function HomeSections({ data }: { data: PublicHomeData }) {
  return <main className="min-h-[50vh]">{homeSectionOrder.map((type) => { // eslint-disable-next-line security/detect-object-injection
    const section = fixedSections[type]; if (!section) return null; switch (type) {
    case "hero": return <HomeHero key={type} section={section} media={null} settings={data.settings}/>;
    case "location": return <Fragment key={type}><WhereWeAre section={section} settings={data.settings}/><ViewAllLink href="/contact#find-us" label="View all location details"/></Fragment>;
    case "experiences-grid": return <ExperiencesSection key={type} section={section} experiences={data.experiences.slice(0, 3)}/>;
    case "why-chawan": return <WhySection key={type} section={section} gallery={data.gallery}/>;
    case "packages": return <PackagesSection key={type} section={section} packages={data.packages.slice(0, 4)}/>;
    case "accommodation": return <Fragment key={type}><AccommodationsSection section={section} accommodations={data.accommodations.slice(0, 2)}/><ViewAllLink href="/accommodation" label="View all accommodation"/></Fragment>;
    case "food": return <Fragment key={type}><FoodSection section={section} food={data.food.slice(0, 2)}/><ViewAllLink href="/food" label="View all food"/></Fragment>;
    case "activities": return <Fragment key={type}><ActivitiesSection section={section} activities={data.activities.slice(0, 4)}/><ViewAllLink href="/activities" label="View all activities"/></Fragment>;
    case "gallery": { const items: HomeGalleryItem[] = data.gallery.filter(() => Boolean(env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)).slice(0, 6).map((item) => ({ id: item.id, category: item.category, caption: text(item.caption), publicId: item.media.publicId, alt: mediaAlt(item.media) })); return <section key={type} id="gallery" className="bg-clay-100"><div className={sectionClass}><CmsHeading content={section.content} eyebrow="Gallery"/><div className="mt-10"><HomeGallery cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} items={items}/></div><Link href="/gallery" className="text-forest-700 mt-8 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">View all gallery →</Link></div></section>; }
    case "rewards-teaser": return <section key={type} className="bg-cream-50"><div className={sectionClass}><RewardsTeaser rule={data.activeRewardRule}/></div></section>;
    case "final-cta": return <ClosingCta key={type} heading={data.settings.home.closing.headline} settings={data.settings}/>;
  } })}<nav aria-label="Explore all home sections" className="bg-cream-50 border-forest-900/10 border-t px-4 py-10 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-3 text-sm font-semibold"><Link href="/experiences">All experiences</Link><Link href="/accommodation">All accommodation</Link><Link href="/packages">All packages</Link><Link href="/food">All food</Link><Link href="/activities">All activities</Link><Link href="/gallery">All gallery</Link><Link href="/stories">All stories</Link><Link href="/contact#find-us">Find us</Link></div></nav></main>;
}
