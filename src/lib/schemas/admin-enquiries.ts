import { z } from "zod";

export const ENQUIRY_TYPES = [
  "GENERAL",
  "PACKAGE",
  "ACTIVITY",
  "ACCOMMODATION",
  "CAMP_ORGANISER",
  "SCHOOL_GROUP",
  "CONTACT_FORM",
] as const;

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "CLOSED",
] as const;

export const adminEnquiryFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  type: z.enum(["ALL", ...ENQUIRY_TYPES]).default("ALL"),
  status: z.enum(["ALL", ...LEAD_STATUSES]).default("ALL"),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminEnquiryFilters = z.infer<typeof adminEnquiryFiltersSchema>;
