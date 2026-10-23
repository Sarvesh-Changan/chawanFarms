import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SectionEyebrowProps = {
  children: ReactNode;
  className?: string;
};

export function SectionEyebrow({ children, className }: SectionEyebrowProps) {
  return (
    <p className={cn("text-laterite-600 text-xs font-semibold tracking-[0.2em] uppercase", className)}>
      <span aria-hidden="true">{"// "}</span>
      <span>{children}</span>
    </p>
  );
}
