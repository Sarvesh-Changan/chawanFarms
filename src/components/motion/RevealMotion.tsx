"use client";

import { motion } from "motion/react";
import * as React from "react";

import type { RevealProps } from "@/components/motion/Reveal";

export function RevealMotion({
  children,
  delay = 0,
  distance = 18,
  duration = 0.55,
  ...props
}: RevealProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
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
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  const shouldAnimate = reducedMotion || isVisible;

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: reducedMotion ? 1 : 0,
        y: reducedMotion ? 0 : distance,
      }}
      animate={{
        opacity: shouldAnimate ? 1 : 0,
        y: shouldAnimate ? 0 : distance,
      }}
      transition={{
        delay: reducedMotion ? 0 : delay,
        duration: reducedMotion ? 0 : duration,
        ease: [0.22, 0.61, 0.36, 1],
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
