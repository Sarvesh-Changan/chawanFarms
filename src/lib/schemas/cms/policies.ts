import { z } from "zod";

import { POLICY_KEYS } from "@/config/page-builder";

const html = z.string().trim().min(1).max(50_000).refine((value) => value.replace(/<[^>]*>/g, "").trim().length > 0, "Policy text is required.");
const policyBody = z.object({ en: html, mr: html.optional(), hi: html.optional() }).strict();

export const policyVersionSaveSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.enum(POLICY_KEYS),
  title: z.string().trim().min(1).max(160),
  body: policyBody,
}).strict();

export const policyVersionPublishSchema = z.object({ id: z.string().uuid() }).strict();
export type PolicyVersionSaveInput = z.infer<typeof policyVersionSaveSchema>;
