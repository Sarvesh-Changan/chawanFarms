"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type ParallaxSceneProps = {
  children: ReactNode;
  label: string;
  quote: string;
  rate?: number;
};

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

function allowsParallax(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  return (navigator as NavigatorWithConnection).connection?.saveData !== true;
}

export function ParallaxScene({ children, label, quote, rate = 0.12 }: ParallaxSceneProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const layer = layerRef.current;
    if (!section || !layer || !allowsParallax()) return;

    let frame = 0;
    let startScrollY = window.scrollY;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = (window.scrollY - startScrollY) * rate;
        layer.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0) scale(1.1)`;
        section.dataset.parallaxOffset = offset.toFixed(2);
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        startScrollY = window.scrollY;
        window.addEventListener("scroll", update, { passive: true });
        update();
      } else {
        window.removeEventListener("scroll", update);
        cancelAnimationFrame(frame);
        layer.style.transform = "translate3d(0, 0, 0) scale(1.1)";
        delete section.dataset.parallaxOffset;
      }
    }, { rootMargin: "120px 0px" });
    observer.observe(section);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
      layer.style.transform = "";
    };
  }, [rate]);

  return (
    <section ref={sectionRef} data-parallax-scene data-parallax-rate={rate} aria-label={label} className="relative h-[125svh] bg-forest-900 text-cream-50">
      <div className="sticky top-0 h-svh overflow-hidden [clip-path:inset(0)]">
        <div ref={layerRef} data-parallax-layer className="absolute inset-[-5%_0] will-change-transform motion-reduce:transform-none">{children}</div>
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgb(18_48_31_/.46),transparent_80%),linear-gradient(0deg,rgb(18_48_31_/.82),transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-7xl items-end px-5 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-8 lg:px-12 lg:pb-20">
          <p className="max-w-4xl font-heading text-[clamp(2.25rem,6.2vw,5.5rem)] leading-[1.02] tracking-[-0.035em]">{quote}</p>
        </div>
      </div>
    </section>
  );
}
