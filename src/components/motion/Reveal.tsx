"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";

export type RevealProps = {
  children?: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  id?: string;
  style?: CSSProperties;
};

const LazyReveal = dynamic(
  () =>
    import("@/components/motion/RevealMotion").then(
      (module) => module.RevealMotion,
    ),
  { ssr: false },
);

export function Reveal(props: RevealProps) {
  return <LazyReveal {...props} />;
}
