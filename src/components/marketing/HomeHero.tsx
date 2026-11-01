import Link from "next/link";

import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";
import { HeroDriftLayer, HeroHeadline, HeroReveal } from "@/components/marketing/HomeHeroMotion";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { isMarketingPhoto } from "@/lib/marketing-media";
import type { PublicHomeData, PublicMedia } from "@/server/services/public-content";

type HeroSection = { content: unknown };
type Content = Record<string, unknown>;

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Content) : {};
}

function text(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function mediaAlt(media: PublicMedia | null | undefined, fallback: string): string {
  if (!media) return fallback;
  const alt = text(media.altText);
  return alt || fallback;
}

export function HomeHero({
  section,
  media,
  settings,
}: {
  section: HeroSection;
  media: PublicMedia | null;
  settings: PublicHomeData["settings"];
}) {
  const content = record(section.content);
  const heading = settings.home.hero.headline || "Come live, experience & rediscover yourself & nature at its best";
  const body =
    settings.home.hero.subhead ||
    "Agri-tourism could create awareness about rural life and knowledge about agriculture science among the urban school children as well as citizens.";
  const eyebrow = text(content.eyebrow) || "// Agri-tourism centre · Kolad, Raigad";
  const primaryLabel = "Plan your stay";
  const primaryHref = "/book";
  const secondaryLabel = "Explore the farm";
  const secondaryHref = "#stays";

  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const mainPhoto = isMarketingPhoto(media) && cloudName ? media : null;
  const inset1Photo =
    isMarketingPhoto(settings.home.hero.inset1Media) && cloudName ? settings.home.hero.inset1Media : null;
  const inset2Photo =
    isMarketingPhoto(settings.home.hero.inset2Media) && cloudName ? settings.home.hero.inset2Media : null;

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="home-hero relative isolate min-h-[100svh] overflow-hidden bg-[#12301f] text-cream-50"
    >
      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_20%,rgb(183_201_107_/0.18),transparent_50%),radial-gradient(ellipse_at_20%_90%,rgb(233_162_27_/0.12),transparent_40%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 py-24 sm:px-8 sm:py-28 lg:px-12 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          {/* Left Column: Text & Actions */}
          <div className="max-w-2xl">
            <HeroReveal>
              <SectionEyebrow className="text-paddy-300 font-mono text-xs sm:text-sm tracking-wider">
                {eyebrow}
              </SectionEyebrow>
            </HeroReveal>

            <HeroHeadline
              id="hero-heading"
              text={heading}
              className="font-heading mt-5 text-[clamp(2.5rem,6.5vw,5.5rem)] leading-[0.96] tracking-[-0.035em] text-cream-50"
            />

            <HeroReveal delay={90}>
              <p
                id="hero-supporting-line"
                className="mt-6 max-w-xl text-base leading-relaxed text-cream-50/85 sm:text-lg sm:leading-8 font-light"
              >
                {body}
              </p>
            </HeroReveal>

            <HeroReveal delay={180} className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                href={primaryHref}
                className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-full px-7 font-semibold shadow-md transition-[transform,background-color] duration-150 ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="border-cream-50/40 text-cream-50 inline-flex min-h-12 items-center justify-center rounded-full border px-6 font-semibold transition-[transform,background-color] duration-150 ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
              >
                {secondaryLabel}
              </Link>
              {settings.whatsappNumber ? (
                <WhatsAppButton
                  number={settings.whatsappNumber}
                  message={settings.whatsappMessage}
                  className="border-cream-50/40 text-cream-50 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 font-semibold transition-[transform,background-color] duration-150 ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
                >
                  Chat on WhatsApp
                </WhatsAppButton>
              ) : null}
              {settings.phones[0] ? (
                <CallButton
                  number={settings.phones[0]}
                  className="text-cream-50 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-3 font-semibold underline decoration-cream-50/40 underline-offset-4 transition-colors duration-150 hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
                >
                  Call the farm
                </CallButton>
              ) : null}
            </HeroReveal>
          </div>

          {/* Right Column: Organic Blob Photo with Overlapping Insets */}
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-square w-full max-w-[460px] mx-auto">
              {/* Main Organic Blob (Centerpiece) */}
              <HeroDriftLayer
                driftRate={0.05}
                delay={200}
                className="relative size-full overflow-hidden shadow-2xl transition-transform duration-700 ease-[var(--motion-ease-standard)]"
              >
                <div
                  className="relative size-full overflow-hidden [border-radius:62%_38%_70%_30%/45%_55%_45%_55%] bg-forest-800"
                  style={{ willChange: "transform" }}
                >
                  {mainPhoto && cloudName ? (
                    <CldImage
                      cloudName={cloudName}
                      publicId={mainPhoto.publicId}
                      resourceType="image"
                      alt={mediaAlt(mainPhoto, "Chawan Farms landscape")}
                      focalX={mainPhoto.focalX}
                      focalY={mainPhoto.focalY}
                      fill
                      priority
                      sizes="(min-width: 1024px) 40vw, 85vw"
                      className="object-cover"
                    />
                  ) : (
                    <LayeredHillsFallback />
                  )}
                </div>
              </HeroDriftLayer>

              {/* Inset 1: Top-Right (e.g. crops/agriculture) */}
              <HeroDriftLayer
                driftRate={-0.04}
                delay={320}
                className="absolute -top-3 -right-3 sm:-top-5 sm:-right-5 z-20 size-28 sm:size-36 md:size-40"
              >
                <div className="relative size-full rounded-full border-4 border-turmeric-500 overflow-hidden shadow-xl bg-forest-700">
                  {inset1Photo && cloudName ? (
                    <CldImage
                      cloudName={cloudName}
                      publicId={inset1Photo.publicId}
                      resourceType="image"
                      alt={mediaAlt(inset1Photo, "Farm crops and greenery")}
                      focalX={inset1Photo.focalX}
                      focalY={inset1Photo.focalY}
                      fill
                      sizes="(min-width: 640px) 144px, 112px"
                      className="object-cover"
                    />
                  ) : (
                    <InsetFallbackCrops />
                  )}
                </div>
              </HeroDriftLayer>

              {/* Inset 2: Bottom-Left (e.g. guest house/stay) */}
              <HeroDriftLayer
                driftRate={0.08}
                delay={440}
                className="absolute -bottom-3 -left-3 sm:-bottom-5 sm:-left-5 z-20 size-28 sm:size-36 md:size-40"
              >
                <div className="relative size-full rounded-full border-4 border-laterite-600 overflow-hidden shadow-xl bg-forest-800">
                  {inset2Photo && cloudName ? (
                    <CldImage
                      cloudName={cloudName}
                      publicId={inset2Photo.publicId}
                      resourceType="image"
                      alt={mediaAlt(inset2Photo, "Guest house and farm cottages")}
                      focalX={inset2Photo.focalX}
                      focalY={inset2Photo.focalY}
                      fill
                      sizes="(min-width: 640px) 144px, 112px"
                      className="object-cover"
                    />
                  ) : (
                    <InsetFallbackGuestHouse />
                  )}
                </div>
              </HeroDriftLayer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Layered hills SVG in the Chawan Farms palette as a graceful fallback when no main photo is set.
 */
function LayeredHillsFallback() {
  return (
    <div
      data-image-placeholder="hero-illustration"
      aria-hidden="true"
      className="relative size-full overflow-hidden bg-[radial-gradient(ellipse_at_70%_25%,rgb(183_201_107_/0.35),transparent_40%),linear-gradient(135deg,#12301f_0%,#1f4d33_60%,#173e28_100%)]"
    >
      <svg
        className="absolute inset-0 size-full text-forest-900"
        viewBox="0 0 600 600"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        {/* Sky glow accent */}
        <circle cx="440" cy="180" r="110" fill="#e9a21b" fillOpacity="0.22" />

        {/* Back hills */}
        <path d="M0 380 Q150 250 320 330 T600 290 L600 600 L0 600 Z" fill="#1f4d33" fillOpacity="0.85" />

        {/* Middle hills */}
        <path d="M0 430 Q180 340 360 410 T600 380 L600 600 L0 600 Z" fill="#4e8f3a" fillOpacity="0.8" />

        {/* Front rolling hill */}
        <path d="M0 490 Q220 420 440 500 T600 480 L600 600 L0 600 Z" fill="#b7c96b" fillOpacity="0.45" />

        {/* Foreground river curve */}
        <path d="M0 550 Q280 500 600 570 L600 600 L0 600 Z" fill="#12301f" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-forest-900/60 via-transparent to-transparent" />
    </div>
  );
}

function InsetFallbackCrops() {
  return (
    <div
      aria-hidden="true"
      className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-turmeric-500/90 to-turmeric-500 text-forest-900 p-2 text-center"
    >
      <svg
        className="size-8 sm:size-10 text-forest-900/80 mb-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21v-8m0 0a4 4 0 10-8 0 4 4 0 008 0zm0 0a4 4 0 118 0 4 4 0 01-8 0z"
        />
      </svg>
      <span className="font-heading text-[10px] sm:text-xs font-semibold tracking-wide uppercase">Crops & Trees</span>
    </div>
  );
}

function InsetFallbackGuestHouse() {
  return (
    <div
      aria-hidden="true"
      className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-laterite-600/90 to-laterite-600 text-cream-50 p-2 text-center"
    >
      <svg
        className="size-8 sm:size-10 text-cream-50/85 mb-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
      <span className="font-heading text-[10px] sm:text-xs font-semibold tracking-wide uppercase">Farm Cottages</span>
    </div>
  );
}
