"use client";

import { ArrowDown, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { prototypeHero } from "@/lib/prototype-data";

type HeroProps = { content: typeof prototypeHero };

export function Hero({ content }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!content.videoSrc || !videoRef.current || !sectionRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const video = videoRef.current;
    const section = sectionRef.current;
    const loadVideo = () => {
      video.src = content.videoSrc ?? "";
      void video.play().catch(() => undefined);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        loadVideo();
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(section);
    return () => observer.disconnect();
  }, [content.videoSrc]);

  return (
    <section ref={sectionRef} className="bg-forest-900 text-cream-50 relative isolate min-h-[clamp(34rem,78svh,52rem)] overflow-hidden">
      <Image src={content.poster} alt={content.posterAlt} fill priority sizes="100vw" className="object-cover opacity-45" />
      <video ref={videoRef} aria-hidden="true" className="absolute inset-0 -z-10 size-full object-cover opacity-0 motion-safe:transition-opacity motion-safe:duration-700" muted loop playsInline poster={content.poster} />
      <div className="from-forest-900 via-forest-900/55 absolute inset-0 -z-[5] bg-gradient-to-r to-transparent" />
      <div className="relative mx-auto flex min-h-[clamp(34rem,78svh,52rem)] max-w-7xl items-end px-4 pb-20 pt-28 sm:px-8 lg:px-12 lg:pb-28">
        <div className="max-w-3xl">
          <p className="text-paddy-300 text-xs font-semibold tracking-[0.22em] uppercase">{content.eyebrow}</p>
          <h1 className="font-heading mt-4 max-w-3xl text-[clamp(3.25rem,11vw,7rem)] leading-[0.94] tracking-tight">{content.title}</h1>
          <p className="text-cream-50/85 mt-6 max-w-xl text-lg leading-8 sm:text-xl">{content.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/book" className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold shadow-lg transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Plan your stay</Link>
            <button type="button" disabled className="border-cream-50/35 text-cream-50/60 inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-lg border px-5 font-semibold" title="WhatsApp number not supplied in the source documents"><MessageCircle aria-hidden="true" className="size-4" />Chat on WhatsApp <span className="sr-only">unavailable until a WhatsApp number is confirmed</span></button>
          </div>
        </div>
      </div>
      <a href="#why" className="text-cream-50/75 absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase focus-visible:outline-2 focus-visible:outline-turmeric-500" aria-label="Scroll to Why Chawan Farms">
        Explore <ArrowDown aria-hidden="true" className="size-4" />
      </a>
    </section>
  );
}
