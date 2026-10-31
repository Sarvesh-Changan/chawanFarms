import Link from "next/link";

import { ClosingCta } from "@/components/marketing/ClosingCta";
import { ExperienceCarousel } from "@/components/marketing/ExperienceCarousel";
import { HomeHero } from "@/components/marketing/HomeHero";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StayCards } from "@/components/marketing/StayCards";
import { WhereWeAre } from "@/components/marketing/WhereWeAre";
import { CldImage } from "@/components/media/CldImage";
import { ParallaxScene } from "@/components/motion/ParallaxScene";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { env } from "@/config/env";
import { isMarketingPhoto, isPublicImage } from "@/lib/marketing-media";
import { mapStayPackages } from "@/lib/stay-catalogue";
import type { PublicHomeData, PublicMedia } from "@/server/services/public-content";

type FixedSection = { content: Record<string, unknown> };

const heroSection: FixedSection = { content: {} };
const sectionClass = "mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28";

function localized(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function Image({ media, sizes, alt }: { media: PublicMedia; sizes: string; alt: string }) {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;
  return <CldImage cloudName={cloudName} publicId={media.publicId} alt={alt} focalX={media.focalX} focalY={media.focalY} fill sizes={sizes} className="object-cover transition-transform duration-[280ms] ease-[var(--motion-ease-standard)] group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:transform-none" />;
}

function ViewAll({ href, children }: { href: string; children: string }) {
  return <Link href={href} className="text-forest-700 mt-8 inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold underline-offset-4 transition-colors duration-160 hover:text-laterite-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500">{children}<span aria-hidden="true">→</span></Link>;
}

function Stays({ packages }: { packages: PublicHomeData["packages"] }) {
  const ready = packages.filter((item) => isPublicImage(item.heroMedia) && item.rates.some((rate) => rate.audience === "ADULT"));
  if (!ready.length) return null;
  return <section id="home-content" aria-labelledby="home-stays-heading" className="bg-cream-50 rounded-t-[2rem] sm:rounded-t-[3rem]">
    <div className={sectionClass}>
      <SectionHeading id="home-stays-heading" eyebrow="Stay with us" title="Choose your way into farm life." description="Explore the published stays and ask the farm team about availability." />
      <Reveal className="mt-8"><StayCards items={mapStayPackages(ready).slice(0, 3)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} showFilters={false} /></Reveal>
      <ViewAll href="/packages">View all stays</ViewAll>
    </div>
  </section>;
}

function Experiences({ items }: { items: PublicHomeData["experiences"] }) {
  const ready = items.filter((item) => isPublicImage(item.heroMedia));
  if (!ready.length) return null;
  return <div className="bg-clay-100 rounded-[2rem] sm:rounded-[3rem]">
    <Reveal><ExperienceCarousel experiences={ready.slice(0, 3)} heading="Time outdoors, together." description="See the farm experiences published by the team." cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} /></Reveal>
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-8 lg:px-12"><ViewAll href="/activities">View all activities</ViewAll></div>
  </div>;
}

function GalleryProof({ gallery, blockedMediaIds }: { gallery: PublicHomeData["gallery"]; blockedMediaIds: ReadonlySet<string> }) {
  const items = gallery.filter((item) => item.isFeatured && isPublicImage(item.media) && !blockedMediaIds.has(item.media.id) && !item.media.tags?.includes("home-scene") && !item.media.tags?.includes("home-food")).slice(0, 3);
  if (!items.length) return null;
  return <section aria-labelledby="home-gallery-heading" className="bg-forest-900 text-cream-50 rounded-[2rem] sm:rounded-[3rem]">
    <div className={sectionClass}>
      <SectionHeading id="home-gallery-heading" eyebrow="A look around" title="A few glimpses of the farm." />
      <Stagger className="mt-8 grid gap-3 sm:grid-cols-3">{items.map((item, index) => item.media ? <Link key={item.id} href="/gallery" className={`group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500 ${index === 0 ? "sm:row-span-2" : ""}`} aria-label="Explore the gallery"><div className={`relative overflow-hidden rounded-2xl bg-forest-700 ${index === 0 ? "aspect-[4/5]" : "aspect-[4/3]"}`}><Image media={item.media} alt={localized(item.media.altText)} sizes="(min-width: 640px) 33vw, 100vw" /></div></Link> : null)}</Stagger>
      <ViewAll href="/gallery">View all photos</ViewAll>
    </div>
  </section>;
}

function HomeStories({ stories }: { stories: PublicHomeData["stories"] }) {
  const ready = stories.filter((story) => isPublicImage(story.coverMedia)).slice(0, 2);
  if (!ready.length) return null;
  return <section className="bg-cream-50 rounded-[2rem] sm:rounded-[3rem]"><div className={sectionClass}><SectionHeading eyebrow="Stories" title="From days spent at the farm." /><div className="mt-8 grid gap-4 md:grid-cols-2">{ready.map((story) => story.coverMedia ? <article key={story.id} className="group overflow-hidden rounded-2xl border border-forest-900/10 bg-clay-100 shadow-sm transition-[transform,box-shadow] duration-[var(--motion-duration-ui)] hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"><Link href={`/stories/${story.slug}`} className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500"><div className="relative aspect-[16/9] overflow-hidden"><Image media={story.coverMedia} alt={localized(story.coverMedia.altText)} sizes="(min-width: 768px) 50vw, 100vw" /></div><div className="p-5 sm:p-6"><h3 className="font-heading text-forest-900 text-2xl">{localized(story.title)}</h3>{localized(story.excerpt) ? <p className="text-mist-500 mt-2 line-clamp-3 text-sm leading-6">{localized(story.excerpt)}</p> : null}</div></Link></article> : null)}</div><ViewAll href="/stories">View all stories</ViewAll></div></section>;
}

function FoodPreview({ food, gallery }: { food: PublicHomeData["food"]; gallery: PublicHomeData["gallery"] }) {
  const photo = gallery.find((item) => item.isFeatured && item.media && item.media.tags?.includes("home-food") && isMarketingPhoto(item.media));
  const category = food.find((item) => item.items.length > 0);
  if (!photo?.media || !category) return null;
  return <section className="bg-paddy-300/25 rounded-[2rem] sm:rounded-[3rem]"><div className={`${sectionClass} grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]`}><div><SectionHeading eyebrow="Food" title="From the farm kitchen." description={localized(category.name)} /><ul className="mt-6 grid gap-3 text-forest-900 sm:grid-cols-2">{category.items.slice(0, 4).map((item) => <li key={item.id} className="border-forest-900/10 rounded-lg border bg-cream-50/75 px-4 py-3 text-sm font-medium">{localized(item.name)}</li>)}</ul><ViewAll href="/food">View all food</ViewAll></div><div className="group relative aspect-[4/3] overflow-hidden rounded-2xl"><Image media={photo.media} alt={localized(photo.media.altText)} sizes="(min-width: 1024px) 40vw, 100vw" /></div></div></section>;
}

function FeatureScenes({ gallery, heroMedia }: { gallery: PublicHomeData["gallery"]; heroMedia: PublicMedia | null }) {
  const heroId = heroMedia?.id;
  const scenes = gallery.filter((item) => item.media && item.media.id !== heroId && item.media.tags?.includes("home-scene") && isMarketingPhoto(item.media, 1920, 1080) && localized(item.caption).trim()).filter((item, index, items) => items.findIndex((candidate) => candidate.media?.id === item.media?.id) === index).slice(0, 4);
  if (scenes.length < 2) return null;
  return <div className="-mx-0 space-y-3 sm:space-y-5">{scenes.map((item) => item.media ? <ParallaxScene key={item.id} label={localized(item.caption)} quote={localized(item.caption)}><Image media={item.media} alt={localized(item.media.altText)} sizes="100vw" /></ParallaxScene> : null)}</div>;
}

function ContactStrip({ settings }: { settings: PublicHomeData["settings"] }) {
  if (!settings.address && !settings.phones.length) return null;
  return <div className="bg-paddy-300/30 rounded-[2rem] sm:rounded-[3rem]"><WhereWeAre section={{ content: { heading: { en: "Find the farm" } } }} settings={settings} /><div className="mx-auto max-w-7xl px-4 pb-12 sm:px-8 lg:px-12"><ViewAll href="/contact#find-us">View travel and contact details</ViewAll></div></div>;
}

export const homeSectionOrder = ["hero", "stays", "feature-scenes", "experiences", "stories", "food", "gallery", "location", "closing-cta"] as const;

export function HomeSections({ data }: { data: PublicHomeData }) {
  const heroHeadline = data.settings.home.hero.headline?.trim() ?? "";
  const configuredClosingHeadline = localized(data.settings.home.closing.headline).trim();
  const closingHeadline = configuredClosingHeadline && configuredClosingHeadline !== heroHeadline ? configuredClosingHeadline : "Your farm stay starts here.";
  const storyMediaIds = new Set(data.stories.filter((story) => isPublicImage(story.coverMedia)).slice(0, 2).flatMap((story) => story.coverMedia ? [story.coverMedia.id] : []));
  const blockedGalleryIds = new Set([...storyMediaIds, ...(data.settings.home.hero.media ? [data.settings.home.hero.media.id] : []), ...data.gallery.flatMap((item) => item.media && (item.media.tags?.includes("home-scene") || item.media.tags?.includes("home-food")) ? [item.media.id] : [])]);
  return <main id="home-content" className="min-h-[50vh] space-y-3 bg-clay-100 sm:space-y-5">
    <HomeHero section={heroSection} media={data.settings.home.hero.media ?? null} settings={data.settings} />
    <Stays packages={data.packages} />
    <FeatureScenes gallery={data.gallery} heroMedia={data.settings.home.hero.media ?? null} />
    <Experiences items={data.experiences} />
    <HomeStories stories={data.stories} />
    <FoodPreview food={data.food} gallery={data.gallery} />
    <GalleryProof gallery={data.gallery} blockedMediaIds={blockedGalleryIds} />
    <ContactStrip settings={data.settings} />
    <ClosingCta heading={closingHeadline} settings={data.settings} />
  </main>;
}
