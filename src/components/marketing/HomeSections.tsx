import Link from "next/link";

import { ActivitiesRow } from "@/components/marketing/ActivitiesRow";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { HomeHero } from "@/components/marketing/HomeHero";
import { HomeStories } from "@/components/marketing/HomeStories";
import { PlateExplorer } from "@/components/marketing/PlateExplorer";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StayCards } from "@/components/marketing/StayCards";
import { WhereWeAre } from "@/components/marketing/WhereWeAre";
import { CldImage } from "@/components/media/CldImage";
import { ParallaxScene } from "@/components/motion/ParallaxScene";
import { Reveal } from "@/components/motion/Reveal";
import { env } from "@/config/env";
import { isMarketingPhoto, isPublicImage } from "@/lib/marketing-media";
import { mapStayPackages } from "@/lib/stay-catalogue";
import type { PublicHomeData, PublicMedia } from "@/server/services/public-content";

type FixedSection = { content: Record<string, unknown> };

const heroSection: FixedSection = { content: {} };
const sectionClass = "mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24";

function localized(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function Image({ media, sizes, alt }: { media: PublicMedia; sizes: string; alt: string }) {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;
  return (
    <CldImage
      cloudName={cloudName}
      publicId={media.publicId}
      alt={alt}
      focalX={media.focalX}
      focalY={media.focalY}
      fill
      sizes={sizes}
      className="object-cover transition-transform duration-[280ms] ease-[var(--motion-ease-standard)] group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:transform-none"
    />
  );
}

function ViewAll({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-forest-700 mt-8 inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold underline-offset-4 transition-colors duration-160 hover:text-laterite-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500"
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function Stays({ packages }: { packages?: PublicHomeData["packages"] }) {
  const ready = (packages ?? []).filter((item) => isPublicImage(item.heroMedia) && item.rates.some((rate) => rate.audience === "ADULT"));
  if (!ready.length) return null;

  return (
    <section
      id="stays"
      aria-labelledby="home-stays-heading"
      className="bg-cream-50 rounded-t-[2.5rem] sm:rounded-t-[3.5rem] relative z-10 shadow-2xl -mt-8 sm:-mt-12 transition-colors duration-300"
    >
      <div className={sectionClass}>
        <SectionHeading
          id="home-stays-heading"
          eyebrow="// STAY WITH US"
          title="Choose your way into farm life"
          description="Explore the published stays and ask the farm team about availability."
        />
        <Reveal className="mt-8">
          <StayCards items={mapStayPackages(ready)} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} showFilters={true} />
        </Reveal>
        <div className="mt-4">
          <ViewAll href="/packages">View all stays</ViewAll>
        </div>
      </div>
    </section>
  );
}

function HomeParallaxScene({ gallery, heroMedia }: { gallery?: PublicHomeData["gallery"]; heroMedia: PublicMedia | null }) {
  const heroId = heroMedia?.id;
  const scene = (gallery ?? []).find(
    (item) =>
      item.media &&
      item.media.id !== heroId &&
      (item.media.tags?.includes("home-scene") || item.isFeatured) &&
      isMarketingPhoto(item.media, 1200, 600)
  );

  if (!scene?.media) return null;

  return (
    <ParallaxScene
      label="Farm landscape scene"
      quote="Imagine a place where time slows down"
      heightClass="h-[420px]"
    >
      <Image media={scene.media} alt={localized(scene.media.altText) || "Farm landscape"} sizes="100vw" />
    </ParallaxScene>
  );
}

function HomeFood({ food }: { food?: PublicHomeData["food"] }) {
  if (!food?.length) return null;
  return (
    <section
      id="food"
      aria-labelledby="home-food-heading"
      className="bg-[#F6E7C1] rounded-t-[2.5rem] sm:rounded-t-[3.5rem] relative z-10 shadow-2xl -mt-8 sm:-mt-12 transition-colors duration-300"
    >
      <div className={sectionClass}>
        <SectionHeading
          id="home-food-heading"
          eyebrow="// FOOD"
          title="Build your plate"
          description="Pick a meal and veg or non-veg, and the plate changes to match."
        />
        <div className="mt-8">
          <PlateExplorer categories={food} />
        </div>
      </div>
    </section>
  );
}

function ContactStrip({ settings }: { settings: PublicHomeData["settings"] }) {
  if (!settings.address && !settings.phones.length) return null;
  return (
    <div id="location" className="bg-cream-50 rounded-t-[2.5rem] sm:rounded-t-[3.5rem] -mt-8 sm:-mt-12 relative z-10 shadow-2xl transition-colors duration-300">
      <WhereWeAre section={{ content: { heading: { en: "Find the farm" } } }} settings={settings} />
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-8 lg:px-12 -mt-8">
        <ViewAll href="/contact#find-us">View travel and contact details</ViewAll>
      </div>
    </div>
  );
}

export const homeSectionOrder = [
  "hero",
  "stays",
  "activities",
  "parallax-scene",
  "stories",
  "food",
  "location",
  "closing-cta",
] as const;

export function HomeSections({ data }: { data: PublicHomeData }) {
  const heroHeadline = data.settings.home.hero.headline?.trim() ?? "";
  const configuredClosingHeadline = localized(data.settings.home.closing.headline).trim();
  const closingHeadline =
    configuredClosingHeadline && configuredClosingHeadline !== heroHeadline
      ? configuredClosingHeadline
      : "Your farm stay starts here.";

  return (
    <main id="home-content" className="min-h-[50vh] overflow-x-hidden bg-forest-900">
      <HomeHero section={heroSection} media={data.settings.home.hero.media ?? null} settings={data.settings} />
      <Stays packages={data.packages} />
      <ActivitiesRow activities={data.activities} />
      <HomeParallaxScene gallery={data.gallery} heroMedia={data.settings.home.hero.media ?? null} />
      <HomeStories stories={data.stories} />
      <HomeFood food={data.food} />
      <ContactStrip settings={data.settings} />
      <ClosingCta heading={closingHeadline} settings={data.settings} />
    </main>
  );
}
