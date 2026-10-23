import Link from "next/link";
import { Fragment } from "react";

import { ClosingCta } from "@/components/marketing/ClosingCta";
import { ExperienceCarousel } from "@/components/marketing/ExperienceCarousel";
import { GuestStoriesCarousel } from "@/components/marketing/GuestStoriesCarousel";
import { HomeGallery, type HomeGalleryItem } from "@/components/marketing/HomeGallery";
import { HomeHero as CmsHomeHero } from "@/components/marketing/HomeHero";
import { HomeStats } from "@/components/marketing/HomeStats";
import { NatureFeature } from "@/components/marketing/NatureFeature";
import { RewardsTeaser } from "@/components/marketing/RewardsTeaser";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { SpotlightBand } from "@/components/marketing/SpotlightBand";
import { StayCards } from "@/components/marketing/StayCards";
import { WhereWeAre } from "@/components/marketing/WhereWeAre";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { mapStayPackages } from "@/lib/stay-catalogue";
import { localizedString, type PublicHomeData, type PublicMedia } from "@/server/services/public-content";

const sectionClass = "mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28";
export const homeSectionOrder = ["hero", "location", "stats", "experiences-grid", "why-chawan", "spotlight", "packages", "accommodation", "food", "activities", "gallery", "stories", "rewards-teaser", "final-cta"] as const;

type PageSection = NonNullable<PublicHomeData["page"]>["sections"][number];
type Content = Record<string, unknown>;

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Content : {};
}

function text(value: unknown): string {
  return localizedString(value as never);
}

function pageContent(section: PageSection | undefined): Content {
  return record(section?.content);
}

function mediaAlt(media: PublicMedia): string {
  return text(media.altText);
}

function mediaResource(media: PublicMedia): "image" | "video" {
  return media.kind === "VIDEO" ? "video" : "image";
}

function CmsHeading({ content, eyebrow }: { content: Content; eyebrow?: string }) {
  const heading = text(content.heading);
  const body = text(content.body);
  if (!heading && !body && !eyebrow) return null;
  return <SectionHeading eyebrow={eyebrow} title={heading || eyebrow || ""} description={body || undefined} />;
}

function MediaImage({ media, priority = false, className = "object-cover", sizes = "(min-width: 1024px) 45vw, 100vw" }: { media: PublicMedia; priority?: boolean; className?: string; sizes?: string }) {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;
  return <CldImage cloudName={cloudName} publicId={media.publicId} resourceType={mediaResource(media)} alt={mediaAlt(media)} focalX={media.focalX} focalY={media.focalY} fill priority={priority} sizes={sizes} className={className} />;
}

function WhySection({ section, gallery }: { section: PageSection; gallery: PublicHomeData["gallery"] }) {
  return <><NatureFeature section={section} gallery={gallery} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/><ViewAllLink href="/activities" label="View all activities"/></>;
}

function ExperiencesSection({ section, experiences }: { section: PageSection; experiences: PublicHomeData["experiences"] }) {
  if (!experiences.length) return null;
  return <><ExperienceCarousel experiences={experiences.slice(0, 6)} heading={text(pageContent(section).heading)} description={text(pageContent(section).body)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/><ViewAllLink href="/experiences" label="View all experiences"/></>;
}

function AccommodationsSection({ section, accommodations }: { section: PageSection; accommodations: PublicHomeData["accommodations"] }) {
  return <section id="accommodation" className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Accommodation" />{accommodations.length ? <div className="mt-10 grid gap-4 md:grid-cols-2">{accommodations.map((item) => <article key={item.id} className="bg-clay-100 overflow-hidden rounded-2xl"><div className="relative aspect-[16/9]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 768px) 50vw, 100vw"/> : null}<div className="from-forest-900/80 absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"/><div className="absolute right-0 bottom-0 left-0 p-5 text-cream-50 sm:p-6"><h3 className="font-heading text-2xl leading-tight">{text(item.name)}</h3>{text(item.summary) || text(item.description) ? <p className="text-cream-50/80 mt-2 text-sm leading-6">{text(item.summary) || text(item.description)}</p> : null}</div></div></article>)}</div> : <EmptyPublished label="accommodation options"/>}</section>;
}

function PackagesSection({ section, packages }: { section: PageSection; packages: PublicHomeData["packages"] }) {
  return <section id="packages" className="bg-cream-50"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Stay with us"/>{packages.length ? <StayCards items={mapStayPackages(packages)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/> : <EmptyPublished label="packages"/>}<ViewAllLink href="/packages" label="View all packages"/></div></section>;
}
function FoodSection({ section, food }: { section: PageSection; food: PublicHomeData["food"] }) {
  return <section id="food" className="bg-paddy-300/25"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Food"/>{food.length ? <div className="mt-10 grid gap-3 md:grid-cols-2">{food.map((category) => <details key={category.id} className="bg-clay-100 rounded-xl p-5" open><summary className="cursor-pointer font-semibold">{text(category.name)}</summary><ul className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm sm:grid-cols-2">{category.items.map((item) => <li className="flex gap-2" key={item.id}><span className="text-leaf-500" aria-hidden="true">•</span><span>{text(item.name)}{item.isExtraCharge ? <span className="text-mist-500"> · extra</span> : null}</span></li>)}</ul></details>)}</div> : <EmptyPublished label="food items"/>}</div></section>;
}

function ActivitiesSection({ section, activities }: { section: PageSection; activities: PublicHomeData["activities"] }) {
  return <section id="activities" className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Activities"/>{activities.length ? <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{activities.map((item) => <article key={item.id} className="bg-cream-50 border-forest-900/10 overflow-hidden rounded-2xl border"><div className="bg-clay-100 relative aspect-[4/3]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"/> : null}{item.isExtraCost ? <span className="bg-turmeric-500 text-ink-900 absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Extra cost</span> : null}</div><div className="p-4"><h3 className="font-heading text-forest-900 text-xl">{text(item.name)}</h3>{text(item.conditionsNote) || text(item.priceNote) ? <p className="text-mist-500 mt-2 text-xs leading-5">{text(item.conditionsNote) || text(item.priceNote)}</p> : null}</div></article>)}</div> : <EmptyPublished label="activities"/>}</section>;
}

function EmptyPublished({ label }: { label: string }) {
  return <p className="bg-clay-100 text-mist-500 mt-10 rounded-2xl p-8 text-center text-sm">No published {label} are available yet.</p>;
}

function ViewAllLink({ href, label }: { href: string; label: string }) {
  return <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-8 lg:px-12"><Link href={href} className="text-forest-700 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{label} →</Link></div>;
}

const defaultHomePage: NonNullable<PublicHomeData["page"]> = {
  id: "default-home",
  slug: "home",
  title: { en: "Home" },
  status: "PUBLISHED",
  publishAt: null,
  template: "default",
  meta: null,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  images: [],
  sections: [
    { id: "s-hero", pageId: "default-home", type: "hero", content: { heading: { en: "Come live, experience & rediscover yourself & nature at its best" }, body: { en: "Agri-tourism could create awareness about rural life and knowledge about agriculture science among the urban school children as well as citizens." }, ctaLabel: { en: "Plan your stay" }, ctaHref: "/book" }, sortOrder: 0, isVisible: true },
    { id: "s-why", pageId: "default-home", type: "why-chawan", content: { heading: { en: "Live with the nature" }, body: { en: "Imagine a place where time slows down." }, items: [] }, sortOrder: 1, isVisible: true },
    { id: "s-exp", pageId: "default-home", type: "experiences-grid", content: { heading: { en: "Horticultural farming, dairy, poultry" }, body: { en: "Organic farming" } }, sortOrder: 2, isVisible: true },
    { id: "s-acc", pageId: "default-home", type: "accommodation", content: { heading: { en: "Camping tents / Dormitory · Guest House" }, body: { en: "Lawn area only for Camp Organisers" } }, sortOrder: 3, isVisible: true },
    { id: "s-pkg", pageId: "default-home", type: "packages", content: { heading: { en: "Per person per day, one night stay" } }, sortOrder: 4, isVisible: true },
    { id: "s-food", pageId: "default-home", type: "food", content: { heading: { en: "Breakfast Menu" } }, sortOrder: 5, isVisible: true },
    { id: "s-act", pageId: "default-home", type: "activities", content: { heading: { en: "Optional activities" }, body: { en: "Arranged according to prevailing conditions and availability" } }, sortOrder: 6, isVisible: true },
    { id: "s-gal", pageId: "default-home", type: "gallery", content: {}, sortOrder: 7, isVisible: true },
    { id: "s-sto", pageId: "default-home", type: "stories", content: {}, sortOrder: 8, isVisible: true },
    { id: "s-rewards", pageId: "default-home", type: "rewards-teaser", content: {}, sortOrder: 9, isVisible: true },
    { id: "s-loc", pageId: "default-home", type: "location", content: { heading: { en: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra" }, body: { en: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra" } }, sortOrder: 10, isVisible: true },
    { id: "s-stats", pageId: "default-home", type: "stats", content: { items: [] }, sortOrder: 11, isVisible: true },
    { id: "s-cta", pageId: "default-home", type: "final-cta", content: { heading: { en: "Come live, experience & rediscover yourself & nature at its best" } }, sortOrder: 12, isVisible: true },
  ],
};

export function HomeSections({ data }: { data: PublicHomeData }) {
  const page = data.page ?? defaultHomePage;
  const sections = new Map(page.sections.map((section) => [section.type, section]));
  const imageMap = new Map(page.images.map((image) => [image.id, image]));
  const imageFor = (section: PageSection | undefined) => {
    const id = pageContent(section).imageMediaId;
    return typeof id === "string" ? imageMap.get(id) ?? null : null;
  };
  return <main className="min-h-[50vh]">{homeSectionOrder.map((type) => {
    const section = sections.get(type);
    if (!section?.isVisible) return null;
    switch (type) {
      case "hero": return <CmsHomeHero key={type} section={section} media={imageFor(section)} settings={data.settings}/>;
      case "why-chawan": return <WhySection key={type} section={section} gallery={data.gallery}/>;
      case "spotlight": return <SpotlightBand key={type} section={section}/>;
      case "experiences-grid": return <ExperiencesSection key={type} section={section} experiences={data.experiences.slice(0, 3)}/>;
      case "accommodation": return <Fragment key={type}><AccommodationsSection section={section} accommodations={data.accommodations.slice(0, 2)}/><ViewAllLink href="/accommodation" label="View all accommodation"/></Fragment>;
      case "packages": return <PackagesSection key={type} section={section} packages={data.packages.slice(0, 4)}/>;
      case "food": return <Fragment key={type}><FoodSection section={section} food={data.food.slice(0, 2)}/><ViewAllLink href="/food" label="View all food"/></Fragment>;
      case "activities": return <Fragment key={type}><ActivitiesSection section={section} activities={data.activities.slice(0, 4)}/><ViewAllLink href="/activities" label="View all activities"/></Fragment>;
      case "gallery": {
        const items: HomeGalleryItem[] = data.gallery.filter(() => Boolean(env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)).slice(0, 6).map((item) => ({ id: item.id, category: item.category, caption: text(item.caption), publicId: item.media.publicId, alt: mediaAlt(item.media) }));
        return <section key={type} id="gallery" className="bg-clay-100"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Gallery"/><div className="mt-10"><HomeGallery cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} items={items}/></div><Link href="/gallery" className="text-forest-700 mt-8 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">View all gallery →</Link></div></section>;
      }
      case "stories": return data.testimonials.some((item) => item.consentConfirmed) ? <Fragment key={type}><GuestStoriesCarousel testimonials={data.testimonials} heading={text(pageContent(section).heading)} description={text(pageContent(section).body)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/><ViewAllLink href="/stories" label="View all stories"/></Fragment> : null;
      case "rewards-teaser": return <section key={type} className="bg-cream-50"><div className={sectionClass}><RewardsTeaser rule={data.activeRewardRule}/></div></section>;
      case "location": return <Fragment key={type}><WhereWeAre section={section} settings={data.settings} media={imageFor(section)}/><ViewAllLink href="/contact#find-us" label="View all location details"/></Fragment>;
      case "stats": return <HomeStats key={type} section={section}/>;
      case "final-cta": return <ClosingCta key={type} heading={text(pageContent(section).heading)} body={text(pageContent(section).body)} settings={data.settings}/>;
    }
  })}<nav aria-label="Explore all home sections" className="bg-cream-50 border-forest-900/10 border-t px-4 py-10 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-3 text-sm font-semibold"><Link href="/experiences">All experiences</Link><Link href="/accommodation">All accommodation</Link><Link href="/packages">All packages</Link><Link href="/food">All food</Link><Link href="/activities">All activities</Link><Link href="/gallery">All gallery</Link><Link href="/stories">All stories</Link><Link href="/contact#find-us">Find us</Link></div></nav></main>;
}
