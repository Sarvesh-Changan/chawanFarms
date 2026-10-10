import { z } from "zod";

export const SEO_ENTITY_TYPES = ["page", "package", "experience", "activity", "accommodation", "post"] as const;
export type SeoEntityType = (typeof SEO_ENTITY_TYPES)[number];

const canonicalUrl = z.string().trim().max(2_048).optional().or(z.literal("")).refine((value) => {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Canonical URLs must be absolute HTTPS URLs.");

export const seoMetadataSchema = z.object({
  entityType: z.enum(SEO_ENTITY_TYPES),
  entityId: z.string().uuid(),
  locale: z.enum(["en", "mr", "hi"]).default("en"),
  title: z.string().trim().max(70).optional().or(z.literal("")),
  description: z.string().trim().max(160).optional().or(z.literal("")),
  keywords: z.string().trim().max(500).optional().or(z.literal("")),
  canonicalUrl,
  robots: z.enum(["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"]).optional().or(z.literal("")),
  ogMediaId: z.string().uuid().optional().or(z.literal("")),
  jsonLd: z.record(z.string(), z.json()).optional().nullable(),
}).strict();

export type SeoMetadataInput = z.input<typeof seoMetadataSchema>;
