import { z } from "zod";

import { localizedTextSchema, optionalLocalizedTextSchema, slugSchema } from "@/lib/schemas/cms/common";
import { localizedHtmlSchema } from "@/lib/schemas/cms/content";

export const storyKindSchema = z.enum(["EXPERIENCE", "STORY", "GUEST"]);
const storyIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid story id.");

export const storyFormSchema = z.object({
  id: storyIdSchema.optional(),
  kind: storyKindSchema.default("STORY"),
  title: localizedTextSchema,
  summary: optionalLocalizedTextSchema.optional(),
  body: localizedHtmlSchema.optional(),
  coverMediaId: z.union([z.string().uuid(), z.literal("")]).optional(),
  photoMediaIds: z.array(z.string().uuid()).max(8, "Choose up to 8 photos.").refine((ids) => new Set(ids).size === ids.length, "Choose each photo once.").default([]),
  videoMediaId: z.union([z.string().uuid(), z.literal("")]).optional(),
  slug: slugSchema,
  featured: z.boolean().default(false),
}).strict();

export const storyListSchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).default("ALL"),
  kind: z.enum(["ALL", "EXPERIENCE", "STORY", "GUEST"]).default("ALL"),
  trash: z.boolean().default(false),
}).strict();

export const storyStatusSchema = z.object({
  id: storyIdSchema,
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  publishAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((value, context) => {
  if (value.status === "SCHEDULED" && !value.publishAt) context.addIssue({ code: "custom", path: ["publishAt"], message: "Choose a publish time." });
  if (value.status !== "SCHEDULED" && value.publishAt) context.addIssue({ code: "custom", path: ["publishAt"], message: "Publish time is only used for scheduled stories." });
});

export const storyReferenceSchema = z.object({ id: storyIdSchema }).strict();
export const storyReorderSchema = storyReferenceSchema.extend({ direction: z.enum(["up", "down"]) }).strict();

export type StoryFormData = z.output<typeof storyFormSchema>;
