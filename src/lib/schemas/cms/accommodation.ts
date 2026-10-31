import { z } from "zod";

import { optionalLocalizedTextSchema, slugSchema, localizedTextSchema } from "./common";

const optionalCapacity = z.union([
  z.number().int().positive().max(100_000),
  z.string().trim().regex(/^\d*$/).max(6).transform((value) => value === "" ? null : Number(value)),
  z.null(),
]).pipe(z.number().int().positive().max(100_000).nullable());

export const accommodationFormSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  type: z.enum(["TENT", "DORMITORY", "GUEST_HOUSE", "CAMP_LAWN", "DAY_VISIT", "COTTAGE"]),
  name: localizedTextSchema,
  summary: optionalLocalizedTextSchema.nullable().optional(),
  description: optionalLocalizedTextSchema.nullable().optional(),
  unitsTotal: optionalCapacity,
  maxGuests: optionalCapacity,
  amenities: optionalLocalizedTextSchema.nullable().optional(),
  heroMediaId: z.union([z.string().uuid(), z.literal(""), z.null()]).transform((value) => value || null),
  imageMediaIds: z.array(z.string().uuid()).max(60).refine((ids) => new Set(ids).size === ids.length, "Choose each gallery image once."),
}).strict();

