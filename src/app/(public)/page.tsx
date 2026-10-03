import type { Metadata } from "next";
import Link from "next/link";

import { AccommodationShowcase } from "@/components/marketing/AccommodationShowcase";
import { ActivityTile } from "@/components/marketing/ActivityTile";
import { ExperienceCard } from "@/components/marketing/ExperienceCard";
import { FinalCta } from "@/components/marketing/FinalCta";
import { FoodSection } from "@/components/marketing/FoodSection";
import { Footer } from "@/components/marketing/Footer";
import { GalleryGrid } from "@/components/marketing/GalleryGrid";
import { Header } from "@/components/marketing/Header";
import { Hero } from "@/components/marketing/Hero";
import { LocationBlock } from "@/components/marketing/LocationBlock";
import { PackageCard } from "@/components/marketing/PackageCard";
import { RewardsTeaser } from "@/components/marketing/RewardsTeaser";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import {
  prototypeActivities,
  prototypeExperiences,
  prototypeHero,
  prototypePackages,
  prototypeStories,
} from "@/lib/prototype-data";

export const metadata: Metadata = {
  title: "Chawan Farms · Where time slows down",
  description: "Come live, experience and rediscover yourself and nature at Chawan Farms, Baitwadi, Kolad.",
};

const sectionClass = "mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero content={prototypeHero} />

        <section id="why" className={`${sectionClass} pb-10 sm:pb-12 lg:pb-16`}>
          <SectionHeading eyebrow="Why Chawan Farms" title="Come closer to the things that make a place feel alive." description="An agri-tourism centre in Baitwadi, Kolad — made for rural-life awareness, agriculture learning, and unhurried time outdoors." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {["Real farm", "Stay close to nature", "Food from the farm kitchen"].map((title, index) => <article className="border-forest-900/10 border-t pt-5" key={title}><span className="text-laterite-600 font-heading text-4xl">0{index + 1}</span><h3 className="font-heading text-forest-900 mt-4 text-2xl">{title}</h3><p className="text-mist-500 mt-2 text-sm leading-6">A place to notice farming, nature and each other at a gentler pace.</p></article>)}
          </div>
        </section>

        <section id="experiences" className="bg-clay-100">
          <div className={sectionClass}>
            <SectionHeading eyebrow="Experiences" title="The farm is the main event." description="Choose a little activity, or simply follow the path that looks interesting." />
            <div className="mt-10 grid gap-4 md:grid-cols-3">{prototypeExperiences.map((experience) => <ExperienceCard key={experience.title} {...experience} />)}</div>
          </div>
        </section>

        <section id="accommodation" className={sectionClass}>
          <SectionHeading eyebrow="Accommodation" title="Stay close to the morning light." description="Tents, dormitory, guest house or a lawn for your own camp — the details are kept simple and clear." />
          <div className="mt-10"><AccommodationShowcase /></div>
          <p className="text-mist-500 mt-4 text-xs">Check-in and check-out are confirmed with your booking. The source document describes a 24-hour stay for the guest house.</p>
        </section>

        <section id="packages" className="bg-cream-50">
          <div className={sectionClass}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><SectionHeading eyebrow="Packages" title="A clear starting point for your day." description="Veg and non-veg rates below are transcribed from PRD Appendix A. Final availability and price are confirmed by the team." /><Link href="/packages" className="text-forest-700 min-h-11 shrink-0 rounded-md py-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">Compare all packages →</Link></div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{prototypePackages.map((packageData) => <PackageCard key={packageData.id} package={packageData} />)}</div>
          </div>
        </section>

        <section id="food" className="bg-paddy-300/25">
          <div className={sectionClass}><SectionHeading eyebrow="Food" title="Set a place for something honest." description="Maharashtrian menu details from the client source, with veg and non-veg options where stated." /><div className="mt-10"><FoodSection /></div></div>
        </section>

        <section id="activities" className={sectionClass}>
          <SectionHeading eyebrow="Activities" title="A day can hold more than one kind of play." description="Activities are arranged according to prevailing conditions and availability." />
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{prototypeActivities.map((activity) => <ActivityTile key={activity.title} {...activity} />)}</div>
        </section>

        <section id="gallery" className="bg-clay-100"><div className={sectionClass}><SectionHeading eyebrow="Gallery" title="A place we are still learning how to photograph." description="These reserved frames protect the layout until original, approved farm photography is available." /><div className="mt-10"><GalleryGrid /></div></div></section>

        <section id="stories" className={sectionClass}><SectionHeading eyebrow="Stories" title={prototypeStories.title} description={prototypeStories.description} /><div className="bg-clay-100 text-mist-500 mt-10 rounded-2xl p-8 text-center text-sm">No testimonials are published in this prototype because the source documents do not include consented customer stories.</div></section>

        <section id="rewards" className="bg-forest-700"><div className={sectionClass}><RewardsTeaser /></div></section>

        <section id="location" className={sectionClass}><SectionHeading eyebrow="Location" title="The road ends at a working farm." /><div className="mt-10"><LocationBlock /></div></section>

        <FinalCta />
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
