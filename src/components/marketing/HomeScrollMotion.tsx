"use client";

import React, { useEffect, useState } from "react";

const SECTIONS = [
  { id: "hero", label: "Top" },
  { id: "stays", label: "Stays" },
  { id: "activities", label: "Activities" },
  { id: "parallax-scene", label: "Landscape" },
  { id: "stories", label: "Stories" },
  { id: "food", label: "Food" },
  { id: "location", label: "Location" },
  { id: "closing-cta", label: "Plan visit" },
] as const;

export function HomeScrollMotion({
  activeSections,
}: {
  activeSections?: readonly string[];
}) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let mediaQuery: MediaQueryList | null = null;
    let onMotionChange: (() => void) | null = null;
    let motionFrame = 0;
    if (typeof window.matchMedia === "function") {
      mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      motionFrame = requestAnimationFrame(() => {
        setReducedMotion(mediaQuery?.matches ?? false);
      });
      onMotionChange = () => setReducedMotion(mediaQuery?.matches ?? false);
      mediaQuery.addEventListener("change", onMotionChange);
    }

    const sectionIds = activeSections ?? SECTIONS.map((s) => s.id);

    let frame = 0;
    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0;
        setScrollProgress(progress);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // IntersectionObserver for active section highlight
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
              setActiveSection(entry.target.id);
            }
          }
        },
        {
          rootMargin: "-15% 0px -50% 0px",
          threshold: [0.25, 0.5],
        }
      );

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      }
    }

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(motionFrame);
      if (mediaQuery && onMotionChange) {
        mediaQuery.removeEventListener("change", onMotionChange);
      }
      window.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, [activeSections]);

  const visibleDots = SECTIONS.filter((s) =>
    (activeSections ?? SECTIONS.map((x) => x.id)).includes(s.id)
  );

  return (
    <>
      {/* Thin scroll progress bar directly under the header */}
      {!reducedMotion && (
        <div
          aria-hidden="true"
          className="fixed top-16 left-0 right-0 h-[3px] z-50 pointer-events-none origin-left bg-turmeric-500 shadow-sm transition-transform duration-75 ease-out"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      )}

      {/* Desktop Section Dots Navigator */}
      <nav
        aria-label="Page sections navigation"
        className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col gap-3 p-2 bg-forest-900/35 backdrop-blur-md rounded-full border border-cream-50/15 shadow-xl transition-opacity duration-300"
      >
        {visibleDots.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              aria-label={`Jump to ${sec.label} section`}
              aria-current={isActive ? "true" : undefined}
              className="group relative flex items-center justify-center size-4 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
            >
              {/* Dot Indicator */}
              <span
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? "size-3 bg-turmeric-500 ring-2 ring-forest-900/40 scale-110 shadow-sm"
                    : "size-1.5 bg-cream-50/60 group-hover:bg-cream-50 group-hover:scale-125"
                }`}
              />

              {/* Accessible hover/focus label tooltip */}
              <span className="absolute right-7 px-2.5 py-1 rounded-md bg-forest-900/90 text-cream-50 text-[11px] font-medium tracking-wide whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 shadow-md">
                {sec.label}
              </span>
            </a>
          );
        })}
      </nav>
    </>
  );
}
