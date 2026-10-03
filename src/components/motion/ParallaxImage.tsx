"use client";

import dynamic from "next/dynamic";
import type { ImageProps } from "next/image";

export type ParallaxImageProps = {
  alt: string;
  className?: string;
  intensity?: number;
  priority?: ImageProps["priority"];
  sizes?: ImageProps["sizes"];
  src: ImageProps["src"];
};

const LazyParallaxImage = dynamic(
  () =>
    import("@/components/motion/ParallaxImageMotion").then(
      (module) => module.ParallaxImageMotion,
    ),
  { ssr: false },
);

export function ParallaxImage(props: ParallaxImageProps) {
  return <LazyParallaxImage {...props} />;
}
