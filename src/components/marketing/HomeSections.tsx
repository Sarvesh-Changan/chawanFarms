import Link from "next/link";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { HomeGallery, type HomeGalleryItem } from "@/components/marketing/HomeGallery";
import { HomeHero as CmsHomeHero } from "@/components/marketing/HomeHero";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { formatINR } from "@/lib/money";
import { localizedString, type PublicHomeData, type PublicMedia } from "@/server/services/public-content";

const sectionClass = "mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28";
const sectionOrder = ["hero", "why-chawan", "experiences-grid", "accommodation", "packages", "food", "activities", "gallery", "stories", "rewards-teaser", "final-cta"] as const;

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

function WhySection({ section }: { section: PageSection }) {
  const content = pageContent(section);
  const items = Array.isArray(content.items) ? content.items.map(record) : [];
  return <section id="why" className={`${sectionClass} pb-10 sm:pb-12 lg:pb-16`}>
    <CmsHeading content={content} eyebrow="Why Chawan Farms" />
    {items.length ? <div className="mt-10 grid gap-4 md:grid-cols-3">{items.map((item, index) => <article className="border-forest-900/10 border-t pt-5" key={`${text(item.title)}-${index}`}><span className="text-laterite-600 font-heading text-4xl">0{index + 1}</span><h3 className="font-heading text-forest-900 mt-4 text-2xl">{text(item.title)}</h3>{text(item.body) ? <p className="text-mist-500 mt-2 text-sm leading-6">{text(item.body)}</p> : null}</article>)}</div> : null}
  </section>;
}

function ExperiencesSection({ section, experiences }: { section: PageSection; experiences: PublicHomeData["experiences"] }) {
  return <section id="experiences" className="bg-clay-100"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Experiences" />{experiences.length ? <div className="mt-10 grid gap-4 md:grid-cols-3">{experiences.map((item) => <article key={item.id} className="group bg-forest-900 text-cream-50 relative min-h-[25rem] overflow-hidden rounded-[1.5rem]">{item.heroMedia ? <MediaImage media={item.heroMedia} className="object-cover opacity-40 transition duration-500 group-hover:scale-105" sizes="(min-width: 768px) 33vw, 100vw" /> : null}<div className="from-forest-900/95 absolute inset-0 bg-gradient-to-t via-forest-900/20 to-transparent"/><div className="relative flex min-h-[25rem] flex-col justify-end p-6 sm:p-7"><h3 className="font-heading text-3xl leading-tight">{text(item.title)}</h3>{text(item.summary) ? <p className="text-cream-50/80 mt-3 max-w-sm text-sm leading-6">{text(item.summary)}</p> : null}<Link href={`/experiences/${item.slug}`} className="text-turmeric-500 mt-5 inline-flex min-h-11 w-fit items-center rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">Explore experience →</Link></div></article>)}</div> : <EmptyPublished label="experiences"/>}</div></section>;
}

function AccommodationsSection({ section, accommodations }: { section: PageSection; accommodations: PublicHomeData["accommodations"] }) {
  return <section id="accommodation" className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Accommodation" />{accommodations.length ? <div className="mt-10 grid gap-4 md:grid-cols-2">{accommodations.map((item) => <article key={item.id} className="bg-clay-100 overflow-hidden rounded-2xl"><div className="relative aspect-[16/9]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 768px) 50vw, 100vw"/> : null}<div className="from-forest-900/80 absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"/><div className="absolute right-0 bottom-0 left-0 p-5 text-cream-50 sm:p-6"><h3 className="font-heading text-2xl leading-tight">{text(item.name)}</h3>{text(item.summary) || text(item.description) ? <p className="text-cream-50/80 mt-2 text-sm leading-6">{text(item.summary) || text(item.description)}</p> : null}</div></div></article>)}</div> : <EmptyPublished label="accommodation options"/>}</section>;
}

function rateFor(packageData: PublicHomeData["packages"][number], audience: "ADULT" | "CHILD_4_10" | "INFANT_UNDER_4") {
  return packageData.rates.filter((rate) => rate.audience === audience);
}

function PackagesSection({ section, packages }: { section: PageSection; packages: PublicHomeData["packages"] }) {
  return <section id="packages" className="bg-cream-50"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Packages"/>{packages.length ? <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{packages.map((item) => {
    const adultRates = rateFor(item, "ADULT");
    const from = adultRates.length ? Math.min(...adultRates.map((rate) => rate.amountPaise)) : null;
    const childRate = rateFor(item, "CHILD_4_10")[0];
    const infantRate = rateFor(item, "INFANT_UNDER_4")[0];
    const inclusions = text(item.inclusions);
    const conditions = text(item.conditions);
    return <article key={item.id} className="bg-cream-50 border-forest-900/10 flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm"><div className="bg-clay-100 relative aspect-[4/3]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"/> : null}{item.code ? <span className="bg-cream-50 text-forest-700 absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold">{item.code}</span> : null}</div><div className="flex flex-1 flex-col p-5 sm:p-6"><h3 className="font-heading text-forest-900 text-2xl leading-tight">{text(item.name)}</h3>{text(item.summary) || text(item.description) ? <p className="text-mist-500 mt-2 text-sm">{text(item.summary) || text(item.description)}</p> : null}<div className="mt-5 min-h-16">{from !== null ? <p className="text-forest-900 font-heading text-3xl">from {formatINR(from)} <span className="text-mist-500 font-sans text-sm font-normal">per person</span></p> : <p className="text-forest-900 font-heading text-2xl">Contact us <span className="text-mist-500 font-sans text-sm font-normal">for rates</span></p>}</div>{childRate || infantRate || item.minGuests || item.maxGuests ? <div className="bg-clay-100 text-forest-900 mt-3 rounded-lg p-3 text-xs leading-5">{childRate ? <p>Children 4–10: {childRate.percentOfAdult ? `${childRate.percentOfAdult}% of adult rate` : formatINR(childRate.amountPaise)}</p> : null}{infantRate && infantRate.amountPaise === 0 ? <p>Under 4: free</p> : null}{item.minGuests ? <p>Minimum group: {item.minGuests}{item.maxGuests ? `–${item.maxGuests}` : ""} persons</p> : null}</div> : null}{inclusions ? <p className="border-forest-900/10 mt-4 border-t pt-4 text-sm leading-6">{inclusions}</p> : null}{conditions ? <p className="text-mist-500 mt-3 text-xs leading-5">{conditions}</p> : null}<Link href={`/book?package=${item.id}`} className="bg-forest-700 text-cream-50 mt-6 inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Enquire about this package</Link></div></article>;
  })}</div> : <EmptyPublished label="packages"/>}</div></section>;
}

function FoodSection({ section, food }: { section: PageSection; food: PublicHomeData["food"] }) {
  return <section id="food" className="bg-paddy-300/25"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Food"/>{food.length ? <div className="mt-10 grid gap-3 md:grid-cols-2">{food.map((category) => <details key={category.id} className="bg-clay-100 rounded-xl p-5" open><summary className="cursor-pointer font-semibold">{text(category.name)}</summary><ul className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm sm:grid-cols-2">{category.items.map((item) => <li className="flex gap-2" key={item.id}><span className="text-leaf-500" aria-hidden="true">•</span><span>{text(item.name)}{item.isExtraCharge ? <span className="text-mist-500"> · extra</span> : null}</span></li>)}</ul></details>)}</div> : <EmptyPublished label="food items"/>}</div></section>;
}

function ActivitiesSection({ section, activities }: { section: PageSection; activities: PublicHomeData["activities"] }) {
  return <section id="activities" className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Activities"/>{activities.length ? <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{activities.map((item) => <article key={item.id} className="bg-cream-50 border-forest-900/10 overflow-hidden rounded-2xl border"><div className="bg-clay-100 relative aspect-[4/3]">{item.heroMedia ? <MediaImage media={item.heroMedia} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"/> : null}{item.isExtraCost ? <span className="bg-turmeric-500 text-ink-900 absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Extra cost</span> : null}</div><div className="p-4"><h3 className="font-heading text-forest-900 text-xl">{text(item.name)}</h3>{text(item.conditionsNote) || text(item.priceNote) ? <p className="text-mist-500 mt-2 text-xs leading-5">{text(item.conditionsNote) || text(item.priceNote)}</p> : null}</div></article>)}</div> : <EmptyPublished label="activities"/>}</section>;
}

function StoriesSection({ section, testimonials, stories }: { section: PageSection; testimonials: PublicHomeData["testimonials"]; stories: PublicHomeData["stories"] }) {
  const content = pageContent(section);
  return <section id="stories" className="bg-clay-100"><div className={sectionClass}><CmsHeading content={content} eyebrow="Customer stories"/>{testimonials.length || stories.length ? <div className="mt-10 grid gap-4 md:grid-cols-2">{testimonials.map((item) => <article key={item.id} className="bg-cream-50 rounded-2xl p-6"><p className="text-forest-900 text-lg leading-8">“{text(item.quote)}”</p><p className="text-mist-500 mt-5 text-sm">{item.authorName}{item.authorMeta ? ` · ${item.authorMeta}` : ""}</p></article>)}{stories.map((item) => <article key={item.id} className="bg-cream-50 rounded-2xl p-6"><h3 className="font-heading text-forest-900 text-2xl">{text(item.title)}</h3>{text(item.excerpt) ? <p className="text-mist-500 mt-3 text-sm leading-6">{text(item.excerpt)}</p> : null}<Link href={`/stories/${item.slug}`} className="text-forest-700 mt-5 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">Read story →</Link></article>)}</div> : <EmptyPublished label="customer stories"/>}</div></section>;
}

function FinalCtaSection({ section }: { section: PageSection }) {
  const content = pageContent(section);
  const heading = text(content.heading);
  const body = text(content.body);
  const label = text(content.ctaLabel) || "Book / enquire";
  const href = typeof content.ctaHref === "string" && content.ctaHref.startsWith("/") && !content.ctaHref.startsWith("//") ? content.ctaHref : "/book";
  return <section id="booking" className="bg-laterite-600 text-cream-50"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-28"><div className="max-w-2xl">{heading ? <h2 className="font-heading text-[clamp(2.5rem,7vw,5rem)] leading-[1]">{heading}</h2> : null}{body ? <SafeHtml html={body} className="text-cream-50/80 mt-4 max-w-xl leading-7"/> : null}</div><Link href={href} className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">{label}</Link></div></section>;
}

function EmptyPublished({ label }: { label: string }) {
  return <p className="bg-clay-100 text-mist-500 mt-10 rounded-2xl p-8 text-center text-sm">No published {label} are available yet.</p>;
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
    { id: "s-why", pageId: "default-home", type: "why-chawan", content: { heading: { en: "Agri-tourism could create awareness about rural life and knowledge about agriculture science among the urban school children as well as citizens" }, items: [] }, sortOrder: 1, isVisible: true },
    { id: "s-exp", pageId: "default-home", type: "experiences-grid", content: { heading: { en: "Horticultural farming, dairy, poultry" }, body: { en: "Organic farming" } }, sortOrder: 2, isVisible: true },
    { id: "s-acc", pageId: "default-home", type: "accommodation", content: { heading: { en: "Camping tents / Dormitory · Guest House" }, body: { en: "Lawn area only for Camp Organisers" } }, sortOrder: 3, isVisible: true },
    { id: "s-pkg", pageId: "default-home", type: "packages", content: { heading: { en: "Per person per day, one night stay" } }, sortOrder: 4, isVisible: true },
    { id: "s-food", pageId: "default-home", type: "food", content: { heading: { en: "Breakfast Menu" } }, sortOrder: 5, isVisible: true },
    { id: "s-act", pageId: "default-home", type: "activities", content: { heading: { en: "Optional activities" }, body: { en: "Arranged according to prevailing conditions and availability" } }, sortOrder: 6, isVisible: true },
    { id: "s-gal", pageId: "default-home", type: "gallery", content: {}, sortOrder: 7, isVisible: true },
    { id: "s-sto", pageId: "default-home", type: "stories", content: {}, sortOrder: 8, isVisible: true },
    { id: "s-loc", pageId: "default-home", type: "location", content: {}, sortOrder: 9, isVisible: true },
    { id: "s-cta", pageId: "default-home", type: "final-cta", content: { heading: { en: "Come live, experience & rediscover yourself & nature at its best" } }, sortOrder: 10, isVisible: true },
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
  return <main className="min-h-[50vh]">{sectionOrder.map((type) => {
    const section = sections.get(type);
    if (!section?.isVisible) return null;
    switch (type) {
      case "hero": return <CmsHomeHero key={type} section={section} media={imageFor(section)} settings={data.settings}/>;
      case "why-chawan": return <WhySection key={type} section={section}/>;
      case "experiences-grid": return <ExperiencesSection key={type} section={section} experiences={data.experiences.slice(0, 3)}/>;
      case "accommodation": return <AccommodationsSection key={type} section={section} accommodations={data.accommodations.slice(0, 2)}/>;
      case "packages": return <PackagesSection key={type} section={section} packages={data.packages.slice(0, 4)}/>;
      case "food": return <FoodSection key={type} section={section} food={data.food.slice(0, 2)}/>;
      case "activities": return <ActivitiesSection key={type} section={section} activities={data.activities.slice(0, 4)}/>;
      case "gallery": {
        const items: HomeGalleryItem[] = data.gallery.filter(() => Boolean(env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)).slice(0, 6).map((item) => ({ id: item.id, category: item.category, caption: text(item.caption), publicId: item.media.publicId, alt: mediaAlt(item.media) }));
        return <section key={type} id="gallery" className="bg-clay-100"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Gallery"/><div className="mt-10"><HomeGallery cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} items={items}/></div></div></section>;
      }
      case "stories": return <StoriesSection key={type} section={section} testimonials={data.testimonials.slice(0, 2)} stories={data.stories.slice(0, 2)}/>;
      case "rewards-teaser": return <section key={type} id="rewards" className="bg-forest-700 text-cream-50"><div className={sectionClass}><CmsHeading content={pageContent(section)} eyebrow="Rewards"/><Link href="/rewards" className="bg-turmeric-500 text-ink-900 mt-8 inline-flex min-h-11 items-center rounded-lg px-5 font-semibold">How rewards work</Link></div></section>;
      case "final-cta": return <FinalCtaSection key={type} section={section}/>;
    }
  })}<nav aria-label="Explore all home sections" className="bg-cream-50 border-forest-900/10 border-t px-4 py-10 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-3 text-sm font-semibold"><Link href="/experiences">All experiences</Link><Link href="/accommodation">All accommodation</Link><Link href="/packages">All packages</Link><Link href="/food">All food</Link><Link href="/activities">All activities</Link><Link href="/gallery">All gallery</Link><Link href="/stories">All stories</Link><Link href="/contact#find-us">Find us</Link></div></nav></main>;
}
