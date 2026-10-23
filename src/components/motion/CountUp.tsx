"use client";

import type { HTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type CountUpProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

const durationMs = 800;

function formatValue(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function easeOut(value: number): number {
  return 1 - ((1 - value) ** 3);
}

export function CountUp({ value, decimals = 0, prefix = "", suffix = "", className, ...props }: CountUpProps) {
  const target = Number.isFinite(value) ? value : 0;
  const safeDecimals = Math.max(0, Math.min(3, Math.trunc(decimals)));
  const [displayValue, setDisplayValue] = useState(target);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (!element || mediaQuery?.matches || typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    let started = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || started) return;
      started = true;
      observer.disconnect();
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        setDisplayValue(target * easeOut(progress));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.12 });

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return <span ref={ref} className={cn("inline-block tabular-nums", className)} {...props}>{prefix}{formatValue(displayValue, safeDecimals)}{suffix}</span>;
}
