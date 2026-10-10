export const PAGE_SECTION_TYPES = [
  "hero",
  "why-chawan",
  "experiences-grid",
  "accommodation",
  "packages",
  "food",
  "activities",
  "gallery",
  "stories",
  "rewards-teaser",
  "location",
  "final-cta",
  "rich-text",
  "image-text",
] as const;

export type PageSectionType = (typeof PAGE_SECTION_TYPES)[number];

export const PAGE_SEED_SECTIONS = [
  "hero", "why-chawan", "experiences-grid", "accommodation", "packages", "food",
  "activities", "gallery", "stories", "rewards-teaser", "location", "final-cta",
] as const satisfies readonly PageSectionType[];

export const POLICY_KEYS = ["stay-rules-and-cancellation", "cancellation", "privacy", "terms"] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export const PAGE_BUILDER_CACHE_TAG = "cms:pages";
export const SEO_CACHE_TAG = "cms:seo";
export const PAGE_BUILDER_MAX_SECTIONS = 30;
