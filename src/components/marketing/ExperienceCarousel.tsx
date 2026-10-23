"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CldImage } from "@/components/media/CldImage";
import type { PublicExperience } from "@/server/services/public-content";

type ExperienceItem = Pick<PublicExperience, "id" | "slug" | "title" | "summary" | "heroMedia">;

function localized(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function optionalQuote(item: ExperienceItem): string {
  const quote = (item as ExperienceItem & { quote?: unknown }).quote;
  return localized(quote);
}

function nearestSlide(slides: Array<HTMLDivElement | null>, viewport: HTMLDivElement): number {
  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.left + viewportRect.width / 2;
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  slides.forEach((slide, index) => {
    if (!slide) return;
    const rect = slide.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - viewportCenter);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
}

export function ExperienceCarousel({ experiences, heading, description, cloudName }: { experiences: readonly ExperienceItem[]; heading?: string; description?: string; cloudName: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const programmaticScroll = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  if (!experiences.length) return null;

  const title = heading || "Our Experiences";
  const headingId = "our-experiences-heading";

  function announce(index: number) {
    const item = experiences.at(index);
    if (!item) return;
    setLiveMessage(`Showing experience ${String(index + 1).padStart(2, "0")}: ${localized(item.title)}`);
  }

  function goTo(index: number, shouldAnnounce = true) {
    const safeIndex = Math.max(0, Math.min(index, experiences.length - 1));
    const slide = slideRefs.current.at(safeIndex);
    if (!slide) return;
    setHasInteracted(true);
    setCurrentIndex(safeIndex);
    if (shouldAnnounce) announce(safeIndex);
    programmaticScroll.current = true;
    window.setTimeout(() => { programmaticScroll.current = false; }, reducedMotion ? 0 : 500);
    if (typeof slide.scrollIntoView === "function") slide.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "start" });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const nextIndex = event.key === "ArrowRight" ? currentIndex + 1 : event.key === "ArrowLeft" ? currentIndex - 1 : event.key === "Home" ? 0 : event.key === "End" ? experiences.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    goTo(nextIndex);
  }

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextIndex = nearestSlide(slideRefs.current, viewport);
    setHasInteracted(true);
    if (nextIndex === currentIndex) return;
    setCurrentIndex(nextIndex);
    if (!programmaticScroll.current) announce(nextIndex);
  }

  return <section id="experiences" aria-labelledby={headingId} className="bg-clay-100"><div className="mx-auto max-w-7xl px-4 py-[var(--space-section-md)] sm:px-8 lg:px-12 lg:py-[var(--space-section-lg)]"><SectionHeading id={headingId} eyebrow="Our Experiences" title={title} description={description || undefined}/><div className="mt-8 flex max-w-[62rem] items-center justify-between gap-4">{!hasInteracted ? <p className="text-mist-500 text-sm sm:hidden">Swipe to explore <span aria-hidden="true">↔</span></p> : null}<div className="ml-auto flex gap-2"><button type="button" className="border-forest-700 text-forest-700 inline-flex size-11 items-center justify-center rounded-full border transition hover:bg-forest-700 hover:text-cream-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} aria-label="Previous experience">←</button><button type="button" className="border-forest-700 text-forest-700 inline-flex size-11 items-center justify-center rounded-full border transition hover:bg-forest-700 hover:text-cream-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === experiences.length - 1} aria-label="Next experience">→</button></div></div><div ref={viewportRef} role="region" aria-roledescription="carousel" aria-label="Our Experiences carousel" tabIndex={0} onKeyDown={handleKeyDown} onScroll={handleScroll} onPointerDown={() => setHasInteracted(true)} onTouchStart={() => setHasInteracted(true)} onWheel={() => setHasInteracted(true)} className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-4 scroll-smooth px-4 pb-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500 motion-reduce:scroll-auto lg:max-w-[62rem] lg:px-0 lg:scroll-px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{experiences.map((item, index) => { const itemTitle = localized(item.title); const summary = localized(item.summary); const quote = optionalQuote(item); const href = item.slug ? `/experiences/${item.slug}` : "/book"; return <div key={item.id} ref={(element) => { // eslint-disable-next-line security/detect-object-injection
      slideRefs.current[index] = element;
    }} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${experiences.length}`} data-experience-slide className="experience-slide experience-slide-reveal snap-start" style={{ animationDelay: `${index * 80}ms` }}><article className="group bg-forest-900 text-cream-50 relative min-h-[31rem] overflow-hidden rounded-[var(--radius-card)]"><div className="absolute inset-0 bg-forest-900">{item.heroMedia && cloudName ? <CldImage cloudName={cloudName} publicId={item.heroMedia.publicId} resourceType={item.heroMedia.kind === "VIDEO" ? "video" : "image"} alt={localized(item.heroMedia.altText) || itemTitle} focalX={item.heroMedia.focalX} focalY={item.heroMedia.focalY} fill sizes="(min-width: 1024px) 30rem, calc(100vw - 3rem)" className="object-cover transition-transform duration-[var(--motion-duration-ui)] ease-[var(--motion-ease-standard)] group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:transform-none"/> : null}</div><div aria-hidden="true" className="from-forest-900/95 absolute inset-0 bg-gradient-to-t via-forest-900/45 to-transparent"/><div className="relative flex min-h-[31rem] flex-col justify-end p-6 sm:p-8"><p className="text-paddy-300 text-xs font-semibold tracking-[0.18em] uppercase">{String(index + 1).padStart(2, "0")}</p><h3 className="font-heading mt-3 text-3xl leading-tight"><Link href={href} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{itemTitle}</Link></h3>{summary ? <p className="text-cream-50/85 mt-3 max-w-prose text-sm leading-6">{summary}</p> : null}{quote ? <blockquote className="border-cream-50/40 mt-5 border-l-2 pl-4 text-sm italic leading-6">{quote}</blockquote> : null}<Link href={href} className="text-turmeric-500 mt-6 inline-flex min-h-11 w-fit items-center rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">{item.slug ? "Explore experience →" : "Enquire →"}</Link></div></article></div>; })}</div><div className="mt-3 flex max-w-[62rem] flex-wrap items-center justify-between gap-4"><div role="group" aria-label="Experience pagination" className="flex flex-wrap gap-2">{experiences.map((item, index) => <button key={item.id} type="button" className="text-forest-700 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-forest-700/30 px-3 text-xs font-semibold transition hover:bg-forest-700 hover:text-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500" aria-label={`Go to experience ${String(index + 1).padStart(2, "0")}: ${localized(item.title)}`} aria-current={currentIndex === index ? "page" : undefined} onClick={() => goTo(index)}>{String(index + 1).padStart(2, "0")}</button>)}</div>{liveMessage ? <p aria-live="polite" className="sr-only">{liveMessage}</p> : null}<p className="text-mist-500 text-xs">{String(currentIndex + 1).padStart(2, "0")} / {String(experiences.length).padStart(2, "0")}</p></div></div></section>;
}
