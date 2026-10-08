import { z } from "zod";

export const localizedMediaTextSchema = z.object({
  en: z.string().trim().max(500).optional(),
  mr: z.string().trim().max(500).optional(),
  hi: z.string().trim().max(500).optional(),
}).strict().transform((values) => ({
  ...(values.en ? { en: values.en } : {}),
  ...(values.mr ? { mr: values.mr } : {}),
  ...(values.hi ? { hi: values.hi } : {}),
}));

export const updateMediaInputSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["IMAGE", "VIDEO"]),
  altText: localizedMediaTextSchema,
  caption: localizedMediaTextSchema,
  focalX: z.number().min(0).max(1).nullable(),
  focalY: z.number().min(0).max(1).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).refine((items) => new Set(items).size === items.length),
  category: z.string().trim().max(80).nullable(),
  isPublic: z.boolean(),
}).strict().superRefine((media, context) => {
  if (media.isPublic && media.kind === "IMAGE" && !media.altText.en) {
    context.addIssue({ code: "custom", path: ["altText", "en"], message: "English alt text is required for public images." });
  }
});

export type LocalizedMediaText = z.infer<typeof localizedMediaTextSchema>;
