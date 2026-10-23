"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type HeroLineStyle = CSSProperties & { "--hero-line-delay"?: string };
type HeroCopyStyle = CSSProperties & { "--hero-copy-delay"?: string };

function prefersStaticHeroMotion(): boolean {
  if (typeof window === "undefined") return true;
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarseMobile = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowPower = coarseMobile && (connection?.saveData === true || (navigator.hardwareConcurrency ?? 8) <= 4 || (deviceMemory ?? 8) <= 4);
  return reduced || lowPower;
}

export function HeroReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ready, setReady] = useState(false);
  const [staticMotion, setStaticMotion] = useState(prefersStaticHeroMotion);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    if (typeof window.matchMedia !== "function") return () => cancelAnimationFrame(frame);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setStaticMotion(prefersStaticHeroMotion());
    reduced.addEventListener("change", updatePreference);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", updatePreference);
    };
  }, []);

  const style: HeroCopyStyle = { "--hero-copy-delay": `${delay}ms` };
  return <div className={cn(className, ready && !staticMotion && "hero-copy-in")} style={style}>{children}</div>;
}

export function HeroHeadline({ text, className, id }: { text: string; className?: string; id?: string }) {
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const wordRefs = useRef(new Map<number, HTMLSpanElement>());
  const [lineIndexes, setLineIndexes] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [staticMotion, setStaticMotion] = useState(prefersStaticHeroMotion);

  useLayoutEffect(() => {
    const measureLines = () => {
      const tops: number[] = [];
      const nextIndexes = words.map((_, index) => {
        const top = wordRefs.current.get(index)?.offsetTop ?? 0;
        const existingLine = tops.findIndex((lineTop) => Math.abs(lineTop - top) < 2);
        if (existingLine >= 0) return existingLine;
        tops.push(top);
        return tops.length - 1;
      });
      setLineIndexes(nextIndexes);
      setReady(true);
    };

    measureLines();
    const element = wordRefs.current.get(0)?.parentElement;
    if (!element) return;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureLines);
      return () => window.removeEventListener("resize", measureLines);
    }
    const observer = new ResizeObserver(measureLines);
    observer.observe(element);
    return () => observer.disconnect();
  }, [words]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setStaticMotion(prefersStaticHeroMotion());
    reduced.addEventListener("change", updatePreference);
    return () => reduced.removeEventListener("change", updatePreference);
  }, []);

  return (
    <h1 id={id} aria-label={text} className={className}>
      {words.map((word, index) => {
        const lineIndex = lineIndexes.at(index) ?? 0;
        const style: HeroLineStyle = { "--hero-line-delay": `${lineIndex * 80}ms` };
        return <span aria-hidden="true" className={cn("mr-[0.24em] inline-block", ready && !staticMotion && "hero-line-in")} key={`${word}-${index}`} ref={(element) => { if (element) wordRefs.current.set(index, element); else wordRefs.current.delete(index); }} style={style}>{word}</span>;
      })}
    </h1>
  );
}

export function HeroBackground({ children, className, rate = 0.95 }: { children: ReactNode; className?: string; rate?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [staticMotion, setStaticMotion] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const frame = requestAnimationFrame(() => setStaticMotion(prefersStaticHeroMotion()));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setStaticMotion(prefersStaticHeroMotion());
    reduced.addEventListener("change", updatePreference);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", updatePreference);
    };
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || staticMotion) return;
    let frame = 0;
    const updateOffset = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const progress = (rect.top + rect.height / 2) / window.innerHeight;
        setOffset((0.5 - progress) * 40 * rate);
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        updateOffset();
        window.addEventListener("scroll", updateOffset, { passive: true });
      } else {
        window.removeEventListener("scroll", updateOffset);
        setOffset(0);
      }
    }, { rootMargin: "120px 0px" });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", updateOffset);
    };
  }, [rate, staticMotion]);

  const transform = staticMotion ? "none" : `translate3d(0, ${offset}px, 0) scale(1.04)`;
  return <div ref={ref} className={cn("absolute inset-[-4%_0] will-change-transform", className)} style={{ transform }}>{children}</div>;
}
