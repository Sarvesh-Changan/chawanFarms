"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type ParallaxSceneProps = {
  children: ReactNode;
  label: string;
  quote: string;
  rate?: number;
  className?: string;
  heightClass?: string;
};

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

function allowsParallax(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return (navigator as NavigatorWithConnection).connection?.saveData !== true;
}

export function ParallaxScene({
  children,
  label,
  quote,
  rate = 0.12,
  className,
  heightClass = "h-[420px]",
}: ParallaxSceneProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const layer = layerRef.current;
    if (!section || !layer || !allowsParallax()) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        // Calculate viewport relative progress
        const windowHeight = window.innerHeight || 800;
        const progress = (windowHeight - rect.top) / (windowHeight + rect.height);
        const offset = (progress - 0.5) * rect.height * rate * 2;
        layer.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0) scale(1.15)`;
        section.dataset.parallaxOffset = offset.toFixed(2);
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          window.addEventListener("scroll", update, { passive: true });
          update();
        } else {
          window.removeEventListener("scroll", update);
          cancelAnimationFrame(frame);
          layer.style.transform = "translate3d(0, 0, 0) scale(1.15)";
          delete section.dataset.parallaxOffset;
        }
      },
      { rootMargin: "120px 0px" }
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
      layer.style.transform = "";
    };
  }, [rate]);

  return (
    <section
      ref={sectionRef}
      data-parallax-scene
      data-parallax-rate={rate}
      aria-label={label}
      className={cn("relative isolate overflow-hidden bg-forest-900 text-cream-50", heightClass, className)}
    >
      <div className="relative size-full overflow-hidden [clip-path:inset(0)]">
        <div
          ref={layerRef}
          data-parallax-layer
          className="absolute inset-[-15%_0] will-change-transform motion-reduce:transform-none"
        >
          {children}
        </div>
        {/* Subtle cinematic gradient overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgb(18_48_31_/0.6),transparent_75%),linear-gradient(0deg,rgb(18_48_31_/0.75),transparent_65%)]"
        />
        <div className="absolute inset-0 mx-auto flex max-w-7xl items-center px-5 sm:px-8 lg:px-12">
          <p className="max-w-3xl font-heading text-[clamp(2rem,5.5vw,4.25rem)] leading-[1.08] tracking-[-0.03em] text-cream-50 drop-shadow-md">
            {quote}
          </p>
        </div>
      </div>
    </section>
  );
}
