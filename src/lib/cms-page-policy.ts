import type { PageSectionType } from "@/config/page-builder";

export function pageCacheTag(slug: string): string {
  return `cms:page:${slug}`;
}

export function pagePath(slug: string): string {
  return slug === "home" ? "/" : `/${slug}`;
}

export function pageRevalidationPaths(slug: string): string[] {
  return [pagePath(slug), "/admin/cms/pages"];
}

export function canPublishPolicy(input: { key: string; pendingDecision?: unknown }): boolean {
  return input.pendingDecision === undefined;
}

export function pageSectionDefaults(type: PageSectionType): Record<string, unknown> {
  const common = { heading: { en: "" }, body: { en: "" } };
  switch (type) {
    case "hero": return { ...common, eyebrow: { en: "" }, heading: { en: "" }, ctaLabel: { en: "" }, ctaHref: "", imageMediaId: null };
    case "why-chawan": return { ...common, items: [] };
    case "rich-text": return { heading: { en: "" }, body: { en: "" } };
    case "image-text": return { heading: { en: "" }, body: { en: "" }, imageMediaId: null, imageSide: "right" };
    default: return { ...common, imageMediaId: null };
  }
}
