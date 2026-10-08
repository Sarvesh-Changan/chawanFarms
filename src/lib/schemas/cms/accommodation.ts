import { z } from "zod";

import { optionalLocalizedTextSchema, slugSchema, localizedTextSchema } from "./common";

const optionalCapacity = z.string().trim().regex(/^\d*$/).max(6)
  .transform((value) => value === "" ? null : Number(value))
  .pipe(z.number().int().positive().max(100_000).nullable());

export const accommodationFormSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  type: z.enum(["TENT", "DORMITORY", "GUEST_HOUSE", "CAMP_LAWN", "DAY_VISIT", "COTTAGE"]),
  name: localizedTextSchema,
  summary: optionalLocalizedTextSchema,
  description: optionalLocalizedTextSchema,
  unitsTotal: optionalCapacity,
  maxGuests: optionalCapacity,
  amenities: optionalLocalizedTextSchema,
  heroMediaId: z.union([z.string().uuid(), z.literal("")]).transform((value) => value || null),
  imageMediaIds: z.array(z.string().uuid()).max(60).refine((ids) => new Set(ids).size === ids.length, "Choose each gallery image once."),
}).strict();

