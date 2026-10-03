"use client";

import { motion } from "motion/react";
import Image, { type ImageProps } from "next/image";
import * as React from "react";

import type { ParallaxImageProps } from "@/components/motion/ParallaxImage";
import { cn } from "@/lib/utils";

export function ParallaxImageMotion({
  alt,
  className,
  intensity = 18,
  priority,
  sizes,
  src,
}: ParallaxImageProps) {
  const [offset, setOffset] = React.useState(0);
  const [isVisible, setIsVisible] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    const element = ref.current;
    if (!element || mediaQuery.matches) {
      setIsVisible(true);
      return () =>
        mediaQuery.removeEventListener("change", updateMotionPreference);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry?.isIntersecting ?? false),
      { rootMargin: "120px 0px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  React.useEffect(() => {
    if (reducedMotion || !isVisible) {
      return;
    }

    let frame = 0;
    const updateOffset = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = ref.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const progress = (rect.top + rect.height / 2) / window.innerHeight;
        setOffset((0.5 - progress) * intensity);
      });
    };

    updateOffset();
    window.addEventListener("scroll", updateOffset, { passive: true });
    window.addEventListener("resize", updateOffset);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateOffset);
      window.removeEventListener("resize", updateOffset);
    };
  }, [intensity, isVisible, reducedMotion]);

  const imageProps: Omit<ImageProps, "alt"> = {
    fill: true,
    priority,
    sizes: sizes ?? "(max-width: 768px) 100vw, 50vw",
    src,
  };

  return (
    <div
      ref={ref}
      className={cn("relative min-h-56 overflow-hidden", className)}
    >
      <motion.div
        animate={{ y: reducedMotion ? 0 : offset }}
        className="absolute inset-[-8%_0]"
        transition={{ duration: 0.2, ease: "linear" }}
      >
        <Image alt={alt} {...imageProps} className="object-cover" />
      </motion.div>
    </div>
  );
}
