import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TagChipProps = {
  children: ReactNode;
  className?: string;
};

export function TagChip({ children, className }: TagChipProps) {
  return <span className={cn("bg-paddy-300/35 text-forest-900 inline-flex min-h-8 items-center rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold", className)}>{children}</span>;
}
