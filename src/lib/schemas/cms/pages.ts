import { z } from "zod";

import { PAGE_BUILDER_MAX_SECTIONS } from "@/config/page-builder";

const localized = z.object({ en: z.string().trim().max(8_000), mr: z.string().trim().max(8_000).optional(), hi: z.string().trim().max(8_000).optional() }).strict();
const nonemptyLocalized = localized.extend({ en: z.string().trim().min(1).max(8_000) });
const optionalMediaId = z.string().uuid().nullable().optional();
const sectionBase = { heading: localized.optional(), body: localized.optional(), imageMediaId: optionalMediaId };
const simpleSection = z.object(sectionBase).strict();

const whyChawanContent = z.object({
  ...sectionBase,
  items: z.array(z.object({ title: nonemptyLocalized, body: localized.optional() }).strict()).max(6),
}).strict();

const heroContent = z.object({
  ...sectionBase,
  heading: nonemptyLocalized,
  eyebrow: localized.optional(),
  ctaLabel: localized.optional(),
  ctaHref: z.string().trim().max(500).refine((value) => !value || value.startsWith("/") && !value.startsWith("//"), "Use a same-site path for the call to action.").optional(),
}).strict();

const richTextContent = z.object({ heading: localized.optional(), body: nonemptyLocalized }).strict();
const imageTextContent = z.object({ heading: localized.optional(), body: nonemptyLocalized, imageMediaId: optionalMediaId, imageSide: z.enum(["left", "right"]).default("right") }).strict();

export const pageSectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), content: heroContent, isVisible: z.boolean().default(true) }).strict(),
  z.object({ type: z.literal("why-chawan"), content: whyChawanContent, isVisible: z.boolean().default(true) }).strict(),
  ...(["experiences-grid", "accommodation", "packages", "food", "activities", "gallery", "stories", "rewards-teaser", "location", "final-cta"] as const).map((type) => z.object({ type: z.literal(type), content: simpleSection, isVisible: z.boolean().default(true) }).strict()),
  z.object({ type: z.literal("rich-text"), content: richTextContent, isVisible: z.boolean().default(true) }).strict(),
  z.object({ type: z.literal("image-text"), content: imageTextContent, isVisible: z.boolean().default(true) }).strict(),
]);

export const pageBuilderSchema = z.object({
  id: z.string().uuid(),
  title: nonemptyLocalized,
  sections: z.array(pageSectionSchema).max(PAGE_BUILDER_MAX_SECTIONS),
}).strict();

export const pageStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["DRAFT", "PUBLISHED"]) }).strict();
export const pagePreviewSchema = z.object({ id: z.string().uuid() }).strict();
export const pageSlugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/)
  .refine((value) => !value.startsWith("-") && !value.endsWith("-") && !value.includes("--"));

export type PageSectionInput = z.input<typeof pageSectionSchema>;
export type PageBuilderInput = z.input<typeof pageBuilderSchema>;
export type PageBuilderData = z.output<typeof pageBuilderSchema>;
