import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StatStrip, type StatStripItem } from "@/components/marketing/StatStrip";

type Content = Record<string, unknown>;
type StatsSection = { content: unknown };

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Content : {};
}

function localized(value: unknown): string {
  const english = record(value).en;
  return typeof english === "string" ? english : "";
}

function statsFromSection(section: StatsSection): StatStripItem[] {
  const items = record(section.content).items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((rawItem) => {
    const item = record(rawItem);
    const label = localized(item.label);
    const value = item.value;
    if (!label || typeof value !== "number" || !Number.isFinite(value)) return [];
    const decimals = typeof item.decimals === "number" ? item.decimals : undefined;
    const prefix = typeof item.prefix === "string" ? item.prefix : undefined;
    const suffix = typeof item.suffix === "string" ? item.suffix : undefined;
    const detail = localized(item.detail);
    return [{ label, countUp: { value, decimals, prefix, suffix }, detail: detail || undefined }];
  });
}

export function HomeStats({ section }: { section: StatsSection }) {
  const content = record(section.content);
  const items = statsFromSection(section);
  if (!items.length) return null;
  const heading = localized(content.heading);
  const body = localized(content.body);
  return <section id="stats" className="bg-clay-100"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12 lg:py-16">{heading || body ? <SectionHeading title={heading || ""} description={body || undefined}/> : null}<StatStrip items={items} className={heading || body ? "mt-10" : undefined}/></div></section>;
}
