import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

import { optionalLocalizedTextSchema } from "./common";

const localizedField = (max: number) => z.object({
  en: z.string().trim().max(max),
  mr: z.string().trim().max(max).optional(),
  hi: z.string().trim().max(max).optional(),
}).strict();

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const phoneInput = z.string().trim().min(3).max(40).transform((value, context) => {
  const parsed = parsePhoneNumberFromString(value, "IN");
  if (!parsed || !parsed.isValid()) {
    context.addIssue({ code: "custom", message: "Enter a valid phone number." });
    return z.NEVER;
  }
  return parsed.number;
});

const phoneList = z.array(z.object({ number: phoneInput, isPrimary: z.boolean() }).strict()).max(10)
  .refine((phones) => phones.length === 0 || phones.filter((phone) => phone.isPrimary).length === 1, "Choose exactly one primary phone number.");

const httpsUrl = z.string().trim().max(2048).refine((value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use an https URL.");

const mediaId = z.string().uuid().nullable();

const settingsFieldsSchema = z.object({
  businessName: localizedField(240),
  businessEmail: z.union([z.string().trim().email().max(254), z.literal("")]).transform((value) => value || null),
  phones: phoneList,
  whatsappNumber: z.union([phoneInput, z.literal("")]).transform((value) => value || null),
  whatsappDefaultMessage: optionalLocalizedTextSchema,
  address: localizedField(1_000),
  ownerDisplay: z.boolean(),
  ownerMediaId: mediaId,
  ownerName: optionalText(120),
  ownerCaption: optionalText(300),
  heroHeadline: optionalText(240),
  heroSubhead: optionalText(1_000),
  heroPrimaryCta: optionalText(100),
  heroSecondaryCta: optionalText(100),
  heroMediaId: mediaId,
  closingHeadline: optionalText(240),
  instagramUrl: z.union([httpsUrl, z.literal("")]).transform((value) => value || null),
  facebookUrl: z.union([httpsUrl, z.literal("")]).transform((value) => value || null),
  youtubeUrl: z.union([httpsUrl, z.literal("")]).transform((value) => value || null),
}).strict().superRefine((value, context) => {
  if (value.ownerDisplay && !value.ownerMediaId) {
    context.addIssue({ code: "custom", path: ["ownerMediaId"], message: "Choose an owner portrait before displaying this section." });
  }
});

const legacySettingsSchema = z.object({
  businessName: localizedField(240), businessPhones: z.string(), businessEmail: z.string(), address: localizedField(1_000), socialLinks: z.array(z.object({ label: z.string(), url: z.string() })), whatsappNumber: z.string(), whatsappDefaultMessage: z.object({ en: z.string(), mr: z.string(), hi: z.string() }),
}).passthrough();

/** Accepts the pre-step-2 settings payload so old seeded/admin clients fail soft while new writes use the strict shape above. */
export const settingsFormSchema = z.preprocess((raw) => {
  const legacy = legacySettingsSchema.safeParse(raw);
  if (!legacy.success || !("businessPhones" in legacy.data)) return raw;
  const value = legacy.data;
  const phones = value.businessPhones.split(/\r?\n/).map((number) => number.trim()).filter(Boolean).map((number, index) => ({ number, isPrimary: index === 0 }));
  const link = (label: string) => value.socialLinks.find((item) => item.label.toLowerCase() === label)?.url ?? "";
  return { businessName: value.businessName, businessEmail: value.businessEmail, phones, whatsappNumber: value.whatsappNumber, whatsappDefaultMessage: value.whatsappDefaultMessage, address: value.address, ownerDisplay: false, ownerMediaId: null, ownerName: "", ownerCaption: "", heroHeadline: "", heroSubhead: "", heroPrimaryCta: "", heroSecondaryCta: "", heroMediaId: null, closingHeadline: "", instagramUrl: link("instagram"), facebookUrl: link("facebook"), youtubeUrl: link("youtube") };
}, settingsFieldsSchema);

const strongPassword = z.string().min(10).max(128).refine((value) => [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length >= 3, "Use at least three of lowercase, uppercase, number and symbol.");

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPassword,
  confirmPassword: z.string().min(10).max(128),
}).strict().superRefine((value, context) => {
  if (value.newPassword !== value.confirmPassword) context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  if (value.newPassword === value.currentPassword) context.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password different from the current password." });
});

export type SettingsFormValues = {
  businessName: { en: string; mr?: string; hi?: string };
  businessEmail: string; phones: Array<{ number: string; isPrimary: boolean }>; whatsappNumber: string; whatsappDefaultMessage: { en?: string; mr?: string; hi?: string }; address: { en: string; mr?: string; hi?: string }; ownerDisplay: boolean; ownerMediaId: string | null; ownerName: string; ownerCaption: string; heroHeadline: string; heroSubhead: string; heroPrimaryCta: string; heroSecondaryCta: string; heroMediaId: string | null; closingHeadline: string; instagramUrl: string; facebookUrl: string; youtubeUrl: string;
};
export type SettingsData = z.output<typeof settingsFormSchema>;
