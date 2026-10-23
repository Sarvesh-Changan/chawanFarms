"use client";

/* eslint-disable security/detect-object-injection */

import { useEffect, useRef, useState } from "react";

import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CldImage } from "@/components/media/CldImage";
import type { PublicHomeData } from "@/server/services/public-content";

type Testimonial = PublicHomeData["testimonials"][number];

function localized(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
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

export function GuestStoriesCarousel({ testimonials, heading, description, cloudName }: { testimonials: readonly Testimonial[]; heading?: string; description?: string; cloudName: string }) {
  const publishedTestimonials = testimonials.filter((item) => item.consentConfirmed);
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

  if (!publishedTestimonials.length) return null;

  const title = heading || "Guest stories";
  const headingId = "guest-stories-heading";

  function announce(index: number) {
    const item = publishedTestimonials.at(index);
    if (!item) return;
    setLiveMessage(`Showing guest story ${String(index + 1).padStart(2, "0")} by ${item.authorName}`);
  }

  function goTo(index: number, shouldAnnounce = true) {
    const safeIndex = Math.max(0, Math.min(index, publishedTestimonials.length - 1));
    const slide = slideRefs.current.at(safeIndex);
    if (!slide) return;
    setHasInteracted(true);
    setCurrentIndex(safeIndex);
    if (shouldAnnounce) announce(safeIndex);
    programmaticScroll.current = true;
    window.setTimeout(() => { programmaticScroll.current = false; }, reducedMotion ? 0 : 500);
    slide.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "start" });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const nextIndex = event.key === "ArrowRight" ? currentIndex + 1 : event.key === "ArrowLeft" ? currentIndex - 1 : event.key === "Home" ? 0 : event.key === "End" ? publishedTestimonials.length - 1 : null;
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

  return <section id="stories" aria-labelledby={headingId} className="bg-clay-100"><div className="mx-auto max-w-7xl px-4 py-[var(--space-section-md)] sm:px-8 lg:px-12 lg:py-[var(--space-section-lg)]"><SectionHeading id={headingId} eyebrow="Guest stories" title={title} description={description || undefined}/><div className="mt-8 flex max-w-[62rem] items-center justify-between gap-4">{!hasInteracted ? <p className="text-mist-500 text-sm sm:hidden">Swipe to explore <span aria-hidden="true">↔</span></p> : null}<div className="ml-auto flex gap-2"><button type="button" className="border-forest-700 text-forest-700 inline-flex size-11 items-center justify-center rounded-full border transition hover:bg-forest-700 hover:text-cream-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} aria-label="Previous guest story">←</button><button type="button" className="border-forest-700 text-forest-700 inline-flex size-11 items-center justify-center rounded-full border transition hover:bg-forest-700 hover:text-cream-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === publishedTestimonials.length - 1} aria-label="Next guest story">→</button></div></div><div ref={viewportRef} role="region" aria-roledescription="carousel" aria-label="Guest stories carousel" tabIndex={0} onKeyDown={handleKeyDown} onScroll={handleScroll} onPointerDown={() => setHasInteracted(true)} onTouchStart={() => setHasInteracted(true)} onWheel={() => setHasInteracted(true)} className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-4 scroll-smooth px-4 pb-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500 motion-reduce:scroll-auto lg:max-w-[62rem] lg:px-0 lg:scroll-px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{publishedTestimonials.map((item, index) => { const quote = localized(item.quote); return <div key={item.id} ref={(element) => { slideRefs.current[index] = element; }} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${publishedTestimonials.length}`} className="guest-story-slide guest-story-reveal snap-start" style={{ animationDelay: `${index * 80}ms` }}><article className="bg-cream-50 border-forest-900/10 grid min-h-[20rem] gap-6 overflow-hidden rounded-[var(--radius-card)] border p-6 sm:grid-cols-[minmax(0,1fr)_12rem] sm:p-8"><div><p className="text-paddy-600 text-xs font-semibold tracking-[0.18em] uppercase">{String(index + 1).padStart(2, "0")}</p><blockquote className="font-heading text-forest-900 mt-5 text-2xl leading-tight sm:text-3xl">“{quote}”</blockquote><p className="text-mist-500 mt-6 text-sm">{item.authorName}{item.authorMeta ? ` · ${item.authorMeta}` : ""}</p></div>{item.media && cloudName ? <div className="relative min-h-40 overflow-hidden rounded-xl"><CldImage cloudName={cloudName} publicId={item.media.publicId} resourceType={item.media.kind === "VIDEO" ? "video" : "image"} alt={localized(item.media.altText)} focalX={item.media.focalX} focalY={item.media.focalY} fill sizes="(min-width: 640px) 12rem, 100vw" className="object-cover"/></div> : null}</article></div>; })}</div><div className="mt-3 flex max-w-[62rem] flex-wrap items-center justify-between gap-4"><div role="group" aria-label="Guest story pagination" className="flex flex-wrap gap-2">{publishedTestimonials.map((item, index) => <button key={item.id} type="button" className="text-forest-700 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-forest-700/30 px-3 text-xs font-semibold transition hover:bg-forest-700 hover:text-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500" aria-label={`Go to guest story ${String(index + 1).padStart(2, "0")}: ${item.authorName}`} aria-current={currentIndex === index ? "page" : undefined} onClick={() => goTo(index)}>{String(index + 1).padStart(2, "0")}</button>)}</div>{liveMessage ? <p aria-live="polite" className="sr-only">{liveMessage}</p> : null}<p className="text-mist-500 text-xs">{String(currentIndex + 1).padStart(2, "0")} / {String(publishedTestimonials.length).padStart(2, "0")}</p></div></div></section>;
}

/* eslint-enable security/detect-object-injection */
