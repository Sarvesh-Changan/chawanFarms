import { cn } from "@/lib/utils";

export type NumberedMarkerProps = {
  value: number | string;
  className?: string;
};

function formatMarker(value: number | string) {
  if (typeof value === "number") return String(value).padStart(2, "0");
  return value.length === 1 ? `0${value}` : value;
}

export function NumberedMarker({ value, className }: NumberedMarkerProps) {
  const marker = formatMarker(value);
  return <span className={cn("font-heading text-laterite-600 text-4xl leading-none", className)} aria-label={`Item ${marker}`}>{marker}</span>;
}
