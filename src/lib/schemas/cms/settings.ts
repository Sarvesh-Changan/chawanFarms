import { z } from "zod";

import { localizedTextSchema, optionalLocalizedTextSchema } from "./common";

const phoneSchema = z.string().trim().min(7).max(24).regex(/^[+0-9 ()-]+$/);
const phoneListSchema = z.string().max(500).transform((value) => value.split(/\r?\n/).map((phone) => phone.trim()).filter(Boolean))
  .pipe(z.array(phoneSchema).max(10));
const emailListSchema = z.string().max(2_000).transform((value) => value.split(/\r?\n/).map((email) => email.trim()).filter(Boolean))
  .pipe(z.array(z.string().email().max(254)).max(50));
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal(""))
  .transform((value) => value || null);
const optionalPositiveIntSchema = z.string().trim().regex(/^\d*$/).max(6)
  .transform((value) => value === "" ? undefined : Number(value))
  .pipe(z.number().int().positive().max(100_000).optional());

export const settingsFormSchema = z.object({
  businessName: localizedTextSchema,
  businessPhones: phoneListSchema,
  businessEmail: z.union([z.string().trim().email().max(254), z.literal("")]).transform((value) => value || null),
  address: localizedTextSchema,
  socialLinks: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    url: z.string().trim().url().max(2048).refine((value) => new URL(value).protocol === "https:", "Use an https URL."),
  }).strict()).max(20),
  whatsappNumber: z.union([phoneSchema, z.literal("")]).transform((value) => value || null),
  whatsappDefaultMessage: optionalLocalizedTextSchema,
  minLeadTimeHours: optionalPositiveIntSchema,
  minimumGroupSize: optionalPositiveIntSchema,
  checkInTime: timeSchema,
  checkOutTime: timeSchema,
  bookingPolicyText: optionalLocalizedTextSchema,
  notificationRecipients: emailListSchema,
}).strict();

export type SettingsFormValues = z.input<typeof settingsFormSchema>;
export type SettingsData = z.output<typeof settingsFormSchema>;

