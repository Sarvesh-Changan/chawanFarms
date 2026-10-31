import Link from "next/link";

import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";
import { HeroBackground, HeroHeadline, HeroReveal } from "@/components/marketing/HomeHeroMotion";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { isMarketingPhoto } from "@/lib/marketing-media";
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

function HeroPoster({ media, cloudName }: { media: PublicMedia; cloudName: string }) {
  return <CldImage cloudName={cloudName} publicId={media.publicId} resourceType="image" alt={mediaAlt(media)} focalX={media.focalX} focalY={media.focalY} fill priority sizes="100vw" className="object-cover" />;
}

export function HomeHero({ section, media, settings }: { section: HeroSection; media: PublicMedia | null; settings: PublicHomeData["settings"] }) {
  const content = record(section.content);
  const heading = settings.home.hero.headline;
  const body = settings.home.hero.subhead;
  const eyebrow = text(content.eyebrow);
  const primaryLabel = "Plan your stay";
  const primaryHref = "/book";
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const heroPhoto = isMarketingPhoto(media) && cloudName ? media : null;

  return <section id="hero" aria-labelledby="hero-heading" className="home-hero text-cream-50 relative isolate min-h-[100svh] overflow-hidden bg-forest-900">
    {heroPhoto && cloudName ? <HeroBackground className="-z-10"><HeroPoster media={heroPhoto} cloudName={cloudName} /></HeroBackground> : <HeroIllustration />}
    <div aria-hidden="true" className="absolute inset-0 z-0 bg-[var(--overlay-hero)]" />
    <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl items-end px-4 pb-28 pt-28 sm:px-8 sm:pb-32 lg:px-12 lg:pb-36">
      <div className="max-w-5xl">
        {eyebrow ? <HeroReveal><SectionEyebrow className="text-paddy-300">{eyebrow}</SectionEyebrow></HeroReveal> : null}
        <HeroHeadline id="hero-heading" text={heading} className="font-heading mt-4 max-w-5xl text-[clamp(3.25rem,8.5vw,7rem)] leading-[0.94] tracking-[-0.045em]" />
        <HeroReveal delay={80} className="max-w-2xl">
          <p id="hero-supporting-line" className="text-cream-50/90 mt-7 max-w-[42rem] text-base leading-7 sm:text-lg sm:leading-8">{body}</p>
        </HeroReveal>
        <HeroReveal delay={160} className="mt-8 flex flex-wrap gap-3">
          <Link href={primaryHref} className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold shadow-lg transition-[transform,background-color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:brightness-95 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">{primaryLabel}</Link>
          {settings.whatsappNumber ? <WhatsAppButton number={settings.whatsappNumber} message={settings.whatsappMessage} className="border-cream-50/60 text-cream-50 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 font-semibold transition-[transform,background-color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Chat on WhatsApp</WhatsAppButton> : null}
          {settings.phones[0] ? <CallButton number={settings.phones[0]} className="text-cream-50 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 font-semibold underline decoration-cream-50/50 underline-offset-4 transition-colors duration-[var(--motion-duration-fast)] hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Call the farm</CallButton> : null}
        </HeroReveal>
      </div>
    </div>
    <Link href="#home-content" aria-label="Scroll to the farm stay details" className="text-cream-50/80 absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 rounded-sm text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500">Explore <span aria-hidden="true">↓</span></Link>
  </section>;
}

function HeroIllustration() {
  return <div data-image-placeholder="hero-illustration" aria-hidden="true" className="home-hero-art absolute inset-0 -z-10 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_74%_17%,rgb(183_201_107_/_0.26),transparent_27%),radial-gradient(ellipse_at_12%_92%,rgb(233_162_27_/_0.11),transparent_35%),linear-gradient(125deg,#12301f_0%,#214b33_46%,#294631_100%)]" />
    <svg className="absolute inset-x-0 bottom-0 h-[58%] w-full text-forest-900/70" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path fill="currentColor" d="M0 310 180 214l134 79 203-158 163 111 197-143 196 136 177-77 190 109v249H0Z" />
      <path fill="#1f4d33" fillOpacity=".74" d="M0 360 192 278l168 69 188-86 177 113 216-121 153 76 159-55 187 80v166H0Z" />
      <path fill="#b7c96b" fillOpacity=".26" d="M0 418c206-52 326-43 488-10s318 38 477-8 326-56 475-21v141H0Z" />
      <path d="M0 430c206-52 326-43 488-10s318 38 477-8 326-56 475-21" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="2" />
    </svg>
    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(18_48_31_/.58),transparent_100%),linear-gradient(0deg,rgb(18_48_31_/.58),transparent_65%)]" />
  </div>;
}
