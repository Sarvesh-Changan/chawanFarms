import Link from "next/link";

import { CallButton } from "@/components/marketing/ContactButtons";
import { HeroBackground, HeroHeadline, HeroReveal } from "@/components/marketing/HomeHeroMotion";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { CldImage } from "@/components/media/CldImage";
import { HeroVideo } from "@/components/media/HeroVideo";
import { env } from "@/config/env";
import type { PublicHomeData, PublicMedia } from "@/server/services/public-content";

type HeroSection = { content: unknown };
type Content = Record<string, unknown>;

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Content : {};
}

function text(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function mediaAlt(media: PublicMedia): string {
  return text(media.altText);
}

function mediaResource(media: PublicMedia): "image" | "video" {
  return media.kind === "VIDEO" ? "video" : "image";
}

function HeroPoster({ media, cloudName }: { media: PublicMedia; cloudName: string }) {
  return <CldImage cloudName={cloudName} publicId={media.publicId} resourceType={mediaResource(media)} alt={mediaAlt(media)} focalX={media.focalX} focalY={media.focalY} fill priority sizes="100vw" className="object-cover" />;
}

export function HomeHero({ section, media, settings }: { section: HeroSection; media: PublicMedia | null; settings: PublicHomeData["settings"] }) {
  const content = record(section.content);
  const heading = settings.home.hero.headline;
  const body = settings.home.hero.subhead;
  const eyebrow = text(content.eyebrow);
  const primaryLabel = settings.home.hero.cta;
  const primaryHref = "/book";
  const secondaryLabel = settings.home.hero.secondaryCta || "Explore experiences";
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const hasFacts = Boolean(settings.address || settings.phones.length);

  return <section id="hero" aria-labelledby="hero-heading" className="bg-forest-900 text-cream-50 relative isolate min-h-[100svh] overflow-hidden">
    {media && cloudName ? <HeroBackground className="-z-10"><HeroPoster media={media} cloudName={cloudName} />{media.kind === "VIDEO" ? <HeroVideo cloudName={cloudName} publicId={media.publicId} className="absolute inset-0" /> : null}</HeroBackground> : null}
    <div aria-hidden="true" className="absolute inset-0 z-0 bg-[var(--overlay-hero)]" />
    <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl items-end px-4 pb-32 pt-28 sm:px-8 sm:pb-28 lg:px-12 lg:pb-36">
      <div className="max-w-4xl">
        {eyebrow ? <HeroReveal><SectionEyebrow className="text-paddy-300">{eyebrow}</SectionEyebrow></HeroReveal> : null}
        <HeroHeadline id="hero-heading" text={heading} className="font-heading mt-4 text-[clamp(2.75rem,7.5vw,5.25rem)] leading-[var(--leading-display)] tracking-tight" />
        <HeroReveal delay={80} className="max-w-2xl">
          <p id="hero-supporting-line" className="text-cream-50/90 mt-6 text-[var(--type-body)] leading-[var(--leading-body)]">{body}</p>
        </HeroReveal>
        <HeroReveal delay={160} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={primaryHref} className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold shadow-lg hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">{primaryLabel}</Link>
          <Link href="/experiences" className="border-cream-50/45 text-cream-50 inline-flex min-h-12 items-center justify-center rounded-lg border px-5 font-semibold hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">{secondaryLabel}</Link>
        </HeroReveal>
      </div>
    </div>
    {hasFacts ? <div className="bg-forest-900/70 absolute inset-x-0 bottom-0 z-10 border-t border-cream-50/20 backdrop-blur-sm"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs text-cream-50/85 sm:px-8 lg:px-12"><span className="font-semibold tracking-[0.14em] text-paddy-300 uppercase">Chawan Farms</span>{settings.address ? <span>{settings.address}</span> : null}{settings.phones.map((phone) => <CallButton key={phone} number={phone} aria-label={`Call ${phone}`} className="inline-flex min-h-8 items-center gap-1 underline-offset-4 hover:text-cream-50 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{phone}</CallButton>)}</div></div> : null}
    <Link href="#why" aria-label="Scroll to Why Chawan Farms" className="text-cream-50/80 absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase motion-safe:animate-bounce focus-visible:outline-2 focus-visible:outline-turmeric-500">Explore <span aria-hidden="true">↓</span></Link>
  </section>;
}
