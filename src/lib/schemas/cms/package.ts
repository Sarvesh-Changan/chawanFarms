import { z } from "zod";

import { optionalIdListSchema, optionalLocalizedTextSchema, slugSchema, localizedTextSchema } from "./common";

const optionalCount = z.string().trim().regex(/^\d*$/).max(6)
  .transform((value) => value === "" ? null : Number(value))
  .pipe(z.number().int().min(0).max(100_000).nullable());

export const packageFormSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  code: z.union([z.string().trim().max(30), z.literal("")]).transform((value) => value || null),
  name: localizedTextSchema,
  summary: optionalLocalizedTextSchema,
  description: optionalLocalizedTextSchema,
  inclusions: optionalLocalizedTextSchema,
  conditions: optionalLocalizedTextSchema,
  minGuests: optionalCount,
  maxGuests: optionalCount,
  timingNote: optionalLocalizedTextSchema,
  isDayVisit: z.boolean(),
  isGroupOnly: z.boolean(),
  heroMediaId: z.union([z.string().uuid(), z.literal("")]).transform((value) => value || null),
  accommodationIds: optionalIdListSchema,
  activityIds: optionalIdListSchema,
}).strict().superRefine((input, context) => {
  if (input.minGuests !== null && input.maxGuests !== null && input.maxGuests < input.minGuests) {
    context.addIssue({ code: "custom", path: ["maxGuests"], message: "Maximum guests cannot be below the minimum." });
  }
});

const paiseFromRupees = z.string().trim().max(12).refine((value) => {
  const parts = value.split(".");
  const rupees = parts[0] ?? "";
  const paise = parts[1];
  return parts.length <= 2 && /^\d+$/.test(rupees) && rupees.length <= 9
    && (rupees === "0" || !rupees.startsWith("0"))
    && (paise === undefined || (/^\d{1,2}$/.test(paise)));
}, "Enter rupees with up to two decimal places.")
  .transform((value) => {
    const [rupees, fraction = ""] = value.split(".");
    return Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  }).pipe(z.number().int().min(0).max(99_999_999_900));

const dateSchema = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
  .refine((value) => {
    if (!value) return true;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date.")
  .transform((value) => value || null);

export const packageRateFormSchema = z.object({
  packageId: z.string().uuid(),
  foodPreference: z.string().pipe(z.enum(["", "VEG", "NON_VEG"])).transform((value) => value || null),
  audience: z.string().pipe(z.enum(["ADULT", "CHILD_4_10", "INFANT_UNDER_4"])),
  unit: z.string().pipe(z.enum(["PER_PERSON_PER_NIGHT", "PER_PERSON_PER_DAY", "PER_UNIT", "FLAT"])),
  amountRupees: paiseFromRupees,
  percentOfAdult: z.string().trim().regex(/^\d*$/).max(3)
    .transform((value) => value === "" ? null : Number(value))
    .pipe(z.number().int().min(0).max(100).nullable()),
  validFrom: dateSchema,
  validTo: dateSchema,
  seasonLabel: z.string().trim().max(120).transform((value) => value || null),
}).strict().superRefine((input, context) => {
  if (input.validFrom && input.validTo && input.validTo < input.validFrom) {
    context.addIssue({ code: "custom", path: ["validTo"], message: "End date must be on or after start date." });
  }
}).transform(({ amountRupees, ...input }) => ({
  ...input,
  amountPaise: amountRupees,
}));

export const packageIdSchema = z.object({ id: z.string().uuid() }).strict();
