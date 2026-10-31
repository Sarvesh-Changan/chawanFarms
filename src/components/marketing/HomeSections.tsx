import Link from "next/link";
import { Fragment } from "react";

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
  "experiences-grid": { content: { heading: { en: "Stories from the farm" } } },
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
function StoriesSection({ section, stories }: { section: FixedSection; stories: PublicHomeData["stories"] }) { if (!stories.length) return null; return <section id="stories" className="bg-cream-50"><div className={sectionClass}><CmsHeading content={section.content} eyebrow="Stories"/><div className="mt-10 grid gap-5 md:grid-cols-3">{stories.slice(0, 3).map((story) => <article key={story.id} className="overflow-hidden rounded-2xl border border-forest-900/10 bg-clay-100"><Link href={`/stories/${story.slug}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"><div className="relative aspect-[16/10] bg-paddy-300">{story.coverMedia ? <MediaImage media={story.coverMedia} sizes="(min-width: 768px) 33vw, 100vw"/> : story.videoMedia ? <MediaImage media={story.videoMedia} sizes="(min-width: 768px) 33vw, 100vw"/> : null}</div><div className="p-5"><p className="text-laterite-600 text-xs font-semibold tracking-[0.16em] uppercase">{story.kind === "GUEST" ? "Guest story" : story.kind === "EXPERIENCE" ? "Farm experience" : "Story"}</p><h3 className="font-heading mt-2 text-2xl text-forest-900">{text(story.title)}</h3>{text(story.excerpt) ? <p className="text-mist-500 mt-2 line-clamp-3 text-sm leading-6">{text(story.excerpt)}</p> : null}</div></Link></article>)}</div><ViewAllLink href="/stories" label="View all stories"/></div></section>; }
function AccommodationsSection({ section, accommodations }: { section: FixedSection; accommodations: PublicHomeData["accommodations"] }) { return <section id="accommodation" className={sectionClass}><CmsHeading content={section.content} eyebrow="Accommodation" />{accommodations.length ? <div className="mt-10 grid gap-4 md:grid-cols-2">{accommodations.map((item) => { const media = item.heroMedia ?? item.gallery?.[0] ?? null; return <article key={item.id} className="bg-clay-100 overflow-hidden rounded-2xl"><div className="relative aspect-[16/9]">{media ? <MediaImage media={media} sizes="(min-width: 768px) 50vw, 100vw"/> : null}<div className="from-forest-900/80 absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"/><div className="absolute right-0 bottom-0 left-0 p-5 text-cream-50 sm:p-6"><h3 className="font-heading text-2xl leading-tight">{text(item.name)}</h3>{text(item.summary) || text(item.description) ? <p className="text-cream-50/80 mt-2 text-sm leading-6">{text(item.summary) || text(item.description)}</p> : null}</div></div></article>; })}</div> : <EmptyPublished label="accommodation options"/>}</section>; }
function PackagesSection({ section, packages }: { section: FixedSection; packages: PublicHomeData["packages"] }) { return <section id="packages" className="bg-cream-50"><div className={sectionClass}><CmsHeading content={section.content} eyebrow="Stay with us"/>{packages.length ? <StayCards items={mapStayPackages(packages)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/> : <EmptyPublished label="packages"/>}<ViewAllLink href="/packages" label="View all packages"/></div></section>; }
function FoodSection({ section, food }: { section: FixedSection; food: PublicHomeData["food"] }) { return <section id="food" className="bg-paddy-300/25"><div className={sectionClass}><CmsHeading content={section.content} eyebrow="Food"/>{food.length ? <div className="mt-10 grid gap-3 md:grid-cols-2">{food.map((category) => <details key={category.id} className="bg-clay-100 rounded-xl p-5" open><summary className="cursor-pointer font-semibold">{text(category.name)}</summary><ul className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm sm:grid-cols-2">{category.items.map((item) => <li className="flex gap-2" key={item.id}><span className="text-leaf-500" aria-hidden="true">•</span><span>{text(item.name)}{item.isExtraCharge ? <span className="text-mist-500"> · {item.extraPricePaise === null ? "extra - quoted by our team" : `extra · ₹${(item.extraPricePaise / 100).toFixed(2).replace(/\.00$/, "")}`}</span> : null}</span></li>)}</ul></details>)}</div> : <EmptyPublished label="food items"/>}</div></section>; }
function ActivitiesSection({ section, activities }: { section: FixedSection; activities: PublicHomeData["activities"] }) { return <section id="activities" className={sectionClass}><CmsHeading content={section.content} eyebrow="Activities"/>{activities.length ? <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{activities.map((item) => <article key={item.id} className="bg-cream-50 border-forest-900/10 overflow-hidden rounded-2xl border"><div className="bg-clay-100 relative aspect-[4/3]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"/> : null}{item.isExtraCost ? <span className="bg-turmeric-500 text-ink-900 absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Extra cost</span> : null}</div><div className="p-4"><h3 className="font-heading text-forest-900 text-xl">{text(item.name)}</h3>{text(item.conditionsNote) || text(item.priceNote) ? <p className="text-mist-500 mt-2 text-xs leading-5">{text(item.conditionsNote) || text(item.priceNote)}</p> : null}</div></article>)}</div> : <EmptyPublished label="activities"/>}</section>; }
function EmptyPublished({ label }: { label: string }) { return <p className="bg-clay-100 text-mist-500 mt-10 rounded-2xl p-8 text-center text-sm">No published {label} are available yet.</p>; }
function OwnerSection({ settings }: { settings: PublicHomeData["settings"] }) {
  if (!settings.owner?.display || !settings.owner.media) return null;
  const name = settings.owner.name;
  return <section className={sectionClass} aria-labelledby="owner-heading"><div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]"><div><p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">The people behind the farm</p><h2 id="owner-heading" className="font-heading mt-3 text-4xl text-forest-900">{name || "A welcome from the farm"}</h2>{settings.owner.caption ? <p className="text-mist-500 mt-4 max-w-xl leading-7">{settings.owner.caption}</p> : null}</div><div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-clay-100"><MediaImage media={settings.owner.media} sizes="(min-width: 768px) 35vw, 100vw"/></div></div></section>;
}
function ViewAllLink({ href, label }: { href: string; label: string }) { return <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-8 lg:px-12"><Link href={href} className="text-forest-700 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{label} →</Link></div>; }

export function HomeSections({ data }: { data: PublicHomeData }) {
  return <main className="min-h-[50vh]">{homeSectionOrder.map((type) => { // eslint-disable-next-line security/detect-object-injection
    const section = fixedSections[type]; if (!section) return null; switch (type) {
    case "hero": return <Fragment key={type}><HomeHero section={section} media={data.settings.home.hero.media ?? null} settings={data.settings}/><OwnerSection settings={data.settings}/></Fragment>;
    case "location": return <Fragment key={type}><WhereWeAre section={section} settings={data.settings}/><ViewAllLink href="/contact#find-us" label="View all location details"/></Fragment>;
    case "experiences-grid": return <StoriesSection key={type} section={section} stories={data.stories}/>;
    case "why-chawan": return <WhySection key={type} section={section} gallery={data.gallery}/>;
    case "packages": return <PackagesSection key={type} section={section} packages={data.packages.slice(0, 4)}/>;
    case "accommodation": return <Fragment key={type}><AccommodationsSection section={section} accommodations={data.accommodations.slice(0, 2)}/><ViewAllLink href="/accommodation" label="View all accommodation"/></Fragment>;
    case "food": return <Fragment key={type}><FoodSection section={section} food={data.food.slice(0, 2)}/><ViewAllLink href="/food" label="View all food"/></Fragment>;
    case "activities": return <Fragment key={type}><ActivitiesSection section={section} activities={data.activities.slice(0, 4)}/><ViewAllLink href="/activities" label="View all activities"/></Fragment>;
    case "rewards-teaser": return <section key={type} className="bg-cream-50"><div className={sectionClass}><RewardsTeaser rule={data.activeRewardRule}/></div></section>;
  } })}</main>;
}
