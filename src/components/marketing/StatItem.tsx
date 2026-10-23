import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatItemProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

export function StatItem({ label, value, detail, className }: StatItemProps) {
  if (value === null || value === undefined || value === "") return null;
  return <div className={cn("border-forest-900/15 border-l pl-4 first:border-l-0 first:pl-0", className)}><p className="font-heading text-forest-900 text-3xl leading-none">{value}</p><p className="text-forest-900 mt-2 text-sm font-semibold">{label}</p>{detail ? <p className="text-mist-500 mt-1 text-xs leading-5">{detail}</p> : null}</div>;
}
