import type { ReactNode } from "react";

import { CountUp, type CountUpProps } from "@/components/motion/CountUp";
import { cn } from "@/lib/utils";

export type StatItemProps = {
  label: string;
  value?: ReactNode;
  countUp?: CountUpProps;
  detail?: ReactNode;
  className?: string;
};

export function StatItem({ label, value, countUp, detail, className }: StatItemProps) {
  if (value === null || value === undefined || value === "" ? !countUp : false) return null;
  return <div className={cn("border-forest-900/15 border-l pl-4 first:border-l-0 first:pl-0", className)}><p className="font-heading text-forest-900 min-h-[1em] text-3xl leading-none">{countUp ? <CountUp {...countUp} /> : value}</p><p className="text-forest-900 mt-2 text-sm font-semibold">{label}</p>{detail ? <p className="text-mist-500 mt-1 text-xs leading-5">{detail}</p> : null}</div>;
}
