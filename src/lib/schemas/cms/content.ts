import { z } from "zod";

import { CMS_CONTENT_TYPES } from "@/config/cms-content";
import { GALLERY_CATEGORIES } from "@/config/gallery";
import { isAllowedCmsLink } from "@/lib/cms-links";

import { localizedTextSchema, optionalLocalizedTextSchema, slugSchema } from "./common";

const htmlString = z.string().max(50_000).refine((value) => {
  const plainText = value.replaceAll("<p></p>", "").replaceAll("<br>", "").trim();
  return plainText.length > 0;
}, "Enter some content.");

export const localizedHtmlSchema = z.object({
  en: htmlString.optional(),
  mr: htmlString.optional(),
  hi: htmlString.optional(),
}).strict().superRefine((value, context) => {
  const hasTranslation = Boolean(value.en || value.mr || value.hi);
  if (hasTranslation && !value.en) context.addIssue({ code: "custom", path: ["en"], message: "English is required when this field is provided." });
}).transform((value) => {
  if (![value.en, value.mr, value.hi].some(Boolean)) return undefined;
  return { en: value.en ?? "", ...(value.mr ? { mr: value.mr } : {}), ...(value.hi ? { hi: value.hi } : {}) };
});

export const cmsLinkSchema = z.string().trim().max(2048).refine(isAllowedCmsLink, "Links must use https:, mailto:, or tel:.");

const optionalSlugSchema = z.union([slugSchema, z.literal("")]).optional();
const optionalString = (max: number) => z.string().trim().max(max).optional();
const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional();
const optionalIds = z.array(z.string().uuid()).max(200).refine((ids) => new Set(ids).size === ids.length, "Choose each linked record once.").optional();
const datetimeInput = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine((value) => {
  const parsed = new Date(value);
  const [datePart = "", timePart = ""] = value.split("T");
  const [year = 0, month = 0, day = 0] = datePart.split("-").map(Number);
  const [hour = -1, minute = -1] = timePart.split(":").map(Number);
  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day && parsed.getHours() === hour && parsed.getMinutes() === minute;
}, "Enter a valid date and time.").transform((value) => new Date(value).toISOString());

const rupeesToPaise = (value: string): number | null => {
  if (!value) return null;
  const [rupees = "", fractional = ""] = value.split(".");
  return Number(rupees) * 100 + Number(fractional.padEnd(2, "0"));
};

const optionalRupees = z.string().trim().max(12).regex(/^$|^[0-9]{1,9}(\.[0-9]{1,2})?$/, "Enter rupees with up to two decimal places.")
  .refine((value) => !value || Number(value) <= 999_999_999.99, "Amount is out of range.")
  .transform(rupeesToPaise).optional();

export const cmsContentFormSchema = z.object({
  entityType: z.enum(CMS_CONTENT_TYPES),
  id: z.string().uuid().optional(),
  slug: optionalSlugSchema,
  title: localizedTextSchema.optional(),
  name: localizedTextSchema.optional(),
  question: localizedTextSchema.optional(),
  quote: localizedTextSchema.optional(),
  summary: optionalLocalizedTextSchema.optional(),
  description: localizedHtmlSchema.optional(),
  body: localizedHtmlSchema.optional(),
  answer: localizedHtmlSchema.optional(),
  groupKey: optionalString(100),
  isExtraCost: z.boolean().optional(),
  priceNote: optionalLocalizedTextSchema.optional(),
  needsPriorNotice: z.boolean().optional(),
  conditionsNote: optionalLocalizedTextSchema.optional(),
  seasonNote: optionalLocalizedTextSchema.optional(),
  heroMediaId: optionalUuid,
  categoryId: optionalUuid,
  foodPreference: z.union([z.enum(["VEG", "NON_VEG"]), z.literal("")]).optional(),
  isExtraCharge: z.boolean().optional(),
  extraPriceRupees: optionalRupees,
  extraUnitLabel: optionalString(80),
  startsAt: datetimeInput.optional(),
  endsAt: datetimeInput.optional(),
  discountType: z.union([z.enum(["FIXED", "PERCENTAGE"]), z.literal("")]).optional(),
  discountValueInput: z.string().trim().max(12).regex(/^$|^[0-9]{1,9}(\.[0-9]{1,2})?$/, "Enter a valid discount value.").optional(),
  packageIds: optionalIds,
  authorName: optionalString(160),
  authorMeta: optionalString(200),
  consentConfirmed: z.boolean().optional(),
  mediaId: optionalUuid,
  category: z.enum(GALLERY_CATEGORIES).optional(),
  caption: optionalLocalizedTextSchema.optional(),
  isFeatured: z.boolean().optional(),
  authorNameForPost: optionalString(160),
  coverMediaId: optionalUuid,
}).strict().superRefine((value, context) => {
  const requireField = (field: keyof typeof value, message: string) => {
    // The field key is selected only from this fixed schema's keys in the switch below.
    // eslint-disable-next-line security/detect-object-injection
    if (value[field] === undefined || value[field] === "") context.addIssue({ code: "custom", path: [field], message });
  };
  switch (value.entityType) {
    case "activity": requireField("slug", "Slug is required."); requireField("name", "Name is required."); break;
    case "experience": requireField("slug", "Slug is required."); requireField("title", "Title is required."); break;
    case "menu-category": requireField("slug", "Slug is required."); requireField("name", "Name is required."); break;
    case "menu-item": requireField("name", "Name is required."); requireField("categoryId", "Choose a menu category."); break;
    case "faq": requireField("question", "Question is required."); requireField("answer", "Answer is required."); break;
    case "offer":
      requireField("slug", "Slug is required."); requireField("title", "Title is required.");
      requireField("startsAt", "Start date is required."); requireField("endsAt", "End date is required.");
      if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after the start date." });
      if (value.discountType && !value.discountValueInput) context.addIssue({ code: "custom", path: ["discountValueInput"], message: "Enter a discount value." });
      if (value.discountType === "PERCENTAGE" && value.discountValueInput && (Number(value.discountValueInput) <= 0 || Number(value.discountValueInput) > 100)) context.addIssue({ code: "custom", path: ["discountValueInput"], message: "Percentage must be between 1 and 100." });
      break;
    case "testimonial": requireField("authorName", "Author name is required."); requireField("quote", "Quote is required."); break;
    case "gallery-item": requireField("mediaId", "Choose an image or video."); requireField("category", "Choose a gallery category."); break;
    case "post": requireField("slug", "Slug is required."); requireField("title", "Title is required."); requireField("body", "Story body is required."); break;
    case "post-category": requireField("slug", "Slug is required."); requireField("name", "Category name is required."); break;
  }
});

export type CmsContentFormInput = z.input<typeof cmsContentFormSchema>;
export type CmsContentFormData = z.output<typeof cmsContentFormSchema>;

export function discountValuePaise(data: CmsContentFormData): number | null {
  if (!data.discountType || !data.discountValueInput) return null;
  return data.discountType === "FIXED" ? rupeesToPaise(data.discountValueInput) : Number(data.discountValueInput);
}

export const cmsContentListQuerySchema = z.object({
  entityType: z.enum(CMS_CONTENT_TYPES),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  q: z.string().trim().max(120).default(""),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
  trash: z.enum(["0", "1"]).default("0").transform((value) => value === "1"),
}).strict();

export const cmsContentStatusSchema = z.object({
  entityType: z.enum(CMS_CONTENT_TYPES),
  id: z.string().uuid(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  publishAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((value, context) => {
  if (value.status === "SCHEDULED" && !value.publishAt && value.entityType !== "offer") context.addIssue({ code: "custom", path: ["publishAt"], message: "Select a publish time." });
  if (value.status !== "SCHEDULED" && value.publishAt) context.addIssue({ code: "custom", path: ["publishAt"], message: "Publish time is only used for scheduled content." });
});

export const cmsContentReferenceSchema = z.object({ entityType: z.enum(CMS_CONTENT_TYPES), id: z.string().uuid() }).strict();
export const cmsContentReorderSchema = cmsContentReferenceSchema.extend({ direction: z.enum(["up", "down"]) }).strict();
export const previewRequestSchema = cmsContentReferenceSchema;
