import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MetaRowProps = {
  items: readonly ReactNode[];
  className?: string;
};

export function MetaRow({ items, className }: MetaRowProps) {
  const visibleItems = items.filter((item) => item !== null && item !== undefined && item !== "");
  if (!visibleItems.length) return null;

  return (
    <div className={cn("text-mist-500 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", className)}>
      {visibleItems.map((item, index) => <span className="inline-flex items-center gap-2" key={index}>{index ? <span aria-hidden="true">·</span> : null}{item}</span>)}
    </div>
  );
}
