import type { ReactNode } from "react";

import { StatItem, type StatItemProps } from "@/components/marketing/StatItem";
import { cn } from "@/lib/utils";

export type StatStripItem = Omit<StatItemProps, "className"> & { value: ReactNode };

export type StatStripProps = {
  items: readonly StatStripItem[];
  className?: string;
};

export function StatStrip({ items, className }: StatStripProps) {
  const visibleItems = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (!visibleItems.length) return null;
  return <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-4", className)}>{visibleItems.map((item) => <StatItem key={item.label} {...item} />)}</div>;
}
