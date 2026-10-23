import { SectionHeading } from "@/components/marketing/SectionHeading";
import { TagChip } from "@/components/marketing/TagChip";

type Content = Record<string, unknown>;
type SpotlightSection = { content: unknown };

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Content : {};
}

function localized(value: unknown): string {
  const english = record(value).en;
  return typeof english === "string" ? english : "";
}

export function SpotlightBand({ section }: { section: SpotlightSection }) {
  const content = record(section.content);
  const items = Array.isArray(content.items) ? content.items.flatMap((item) => {
    const label = localized(record(item).label);
    return label ? [label] : [];
  }).slice(0, 6) : [];
  if (items.length < 4) return null;
  const heading = localized(content.heading) || "Spotlight";
  const description = localized(content.body);

  return <section aria-labelledby="spotlight-heading" className="bg-forest-900 text-cream-50"><div className="mx-auto max-w-7xl px-4 py-[var(--space-section-md)] sm:px-8 lg:px-12"><SectionHeading id="spotlight-heading" eyebrow="Spotlight" title={heading} description={description || undefined} descriptionClassName="text-cream-50/75" className="text-cream-50"/><div className="mt-8 flex flex-wrap gap-3">{items.map((item) => <TagChip key={item} className="bg-cream-50/90 text-forest-900">{item}</TagChip>)}</div></div></section>;
}
