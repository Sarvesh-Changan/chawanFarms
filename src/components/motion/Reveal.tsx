"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type RevealProps = {
  children?: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  duration?: number;
  id?: string;
  style?: CSSProperties;
};

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

export function Reveal({ children, className, delay = 0, distance = 12, duration = 500, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as NavigatorWithConnection).connection?.saveData === true;
    if (reduced || saveData) return;

    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight) return;
    setVisible(false);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties = {
    ...props.style,
    "--reveal-distance": `${distance}px`,
    "--reveal-duration": `${duration}ms`,
    "--reveal-delay": `${delay}ms`,
  } as CSSProperties;

  return <div ref={ref} {...props} className={className} data-reveal-state={visible ? "visible" : "hidden"} style={style}>{children}</div>;
}
