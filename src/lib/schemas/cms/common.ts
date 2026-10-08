import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/config/locales";

const localizedShape = {
  en: z.string().trim().min(1, "English is required.").max(10_000),
  mr: z.string().trim().max(10_000).optional(),
  hi: z.string().trim().max(10_000).optional(),
} satisfies Record<(typeof SUPPORTED_LOCALES)[number], z.ZodTypeAny>;

export const localizedTextSchema = z.object(localizedShape).strict();
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const optionalLocalizedTextSchema = z.object({
  en: z.string().trim().max(10_000).optional(),
  mr: z.string().trim().max(10_000).optional(),
  hi: z.string().trim().max(10_000).optional(),
}).strict().superRefine((value, context) => {
  const hasTranslation = [value.en, value.mr, value.hi].some((entry) => Boolean(entry));
  if (hasTranslation && !value.en) {
    context.addIssue({ code: "custom", path: ["en"], message: "English is required when this field is provided." });
  }
}).transform((value) => {
  if (![value.en, value.mr, value.hi].some((entry) => Boolean(entry))) return undefined;
  return { en: value.en ?? "", ...(value.mr ? { mr: value.mr } : {}), ...(value.hi ? { hi: value.hi } : {}) };
});

export const slugSchema = z.string().trim().min(1).max(120)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens.")
  .refine((value) => !value.startsWith("-") && !value.endsWith("-") && !value.includes("--"), "Use lowercase letters, numbers and single hyphens.");

export const nullableText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const localizedStringListSchema = z.array(z.string().trim().min(1).max(500)).max(100);

export const optionalIdListSchema = z.array(z.string().uuid()).max(100)
  .refine((values) => new Set(values).size === values.length, "Choose each linked item once.");

export const cmsEntityStatusSchema = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);

export const publishInputSchema = z.object({
  entityType: z.enum(["package", "accommodation"]),
  id: z.string().uuid(),
  status: cmsEntityStatusSchema,
  publishAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((input, context) => {
  if (input.status === "SCHEDULED" && !input.publishAt) {
    context.addIssue({ code: "custom", path: ["publishAt"], message: "Choose a publish date and time." });
  }
  if (input.status !== "SCHEDULED" && input.publishAt) {
    context.addIssue({ code: "custom", path: ["publishAt"], message: "A publish time is only used for scheduled content." });
  }
});

export const entityReferenceSchema = z.object({
  entityType: z.enum(["package", "accommodation"]),
  id: z.string().uuid(),
}).strict();

export const reorderInputSchema = entityReferenceSchema.extend({
  direction: z.enum(["up", "down"]),
}).strict();

export const cmsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  q: z.string().trim().max(120).default(""),
  status: cmsEntityStatusSchema.optional(),
  trash: z.enum(["0", "1"]).default("0").transform((value) => value === "1"),
  sort: z.enum(["sortOrder", "updatedAt", "status"]).default("sortOrder"),
  direction: z.enum(["asc", "desc"]).default("asc"),
}).strict();

