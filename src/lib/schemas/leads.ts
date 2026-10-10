import { z } from "zod";

import { attributionSchema } from "@/lib/attribution";

const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const email = z.string().trim().max(254).email().transform((value) => value.toLowerCase()).optional().or(z.literal(""));

export const leadFormSchema = z.object({
  formType: z.enum(["QUICK", "CONTACT", "PACKAGE", "ACTIVITY", "CAMP_ORGANISER", "SCHOOL_GROUP"]),
  submissionId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  phone: z.string().trim().min(7).max(32),
  email,
  message: z.string().trim().max(4_000).optional().or(z.literal("")),
  preferredStart: date,
  preferredEnd: date,
  groupSize: z.number().int().positive().max(10_000).optional(),
  packageId: z.string().uuid().optional(),
  activityId: z.string().uuid().optional(),
  consentToContact: z.boolean().refine((value) => value, "Please agree to be contacted about this enquiry."),
  turnstileToken: z.string().trim().max(2048).optional(),
  honeypot: z.string().max(200).optional(),
  startedAt: z.number().int().positive(),
  pagePath: z.string().trim().startsWith("/").max(500).refine((value) => !value.startsWith("//") && !/[?#\r\n]/.test(value)),
  attribution: attributionSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.preferredStart && input.preferredEnd && input.preferredEnd < input.preferredStart) {
    context.addIssue({ code: "custom", path: ["preferredEnd"], message: "End date must be on or after the start date." });
  }
  if (input.formType === "PACKAGE" && !input.packageId) context.addIssue({ code: "custom", path: ["packageId"], message: "Choose a package." });
  if (input.formType === "ACTIVITY" && !input.activityId) context.addIssue({ code: "custom", path: ["activityId"], message: "Choose an activity." });
  if (input.formType === "CAMP_ORGANISER" && (input.groupSize === undefined || input.groupSize < 30 || input.groupSize > 50)) {
    context.addIssue({ code: "custom", path: ["groupSize"], message: "Camp organiser groups must be between 30 and 50 people." });
  }
  if (input.formType === "SCHOOL_GROUP" && input.groupSize === undefined) {
    context.addIssue({ code: "custom", path: ["groupSize"], message: "Enter the number of students and accompanying adults." });
  }
});

export const leadEventSchema = z.object({
  type: z.enum(["WHATSAPP_CLICK", "CALL_CLICK"]),
  path: z.string().trim().startsWith("/").max(500).refine((value) => !value.startsWith("//") && !/[?#\r\n]/.test(value)),
  anonymousId: z.string().uuid(),
}).strict();

export type LeadFormValues = z.input<typeof leadFormSchema>;
export type LeadFormInput = z.output<typeof leadFormSchema>;
