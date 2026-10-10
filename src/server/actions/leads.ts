"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { env } from "@/config/env";
import { LEAD_FORM_LIMITS } from "@/config/leads";
import { isLeadHoneypotTripped } from "@/lib/lead-policy";
import { err, ok, type Result } from "@/lib/result";
import { leadEventSchema, leadFormSchema } from "@/lib/schemas/leads";
import { getValidatedAttribution } from "@/server/attribution";
import { getSession } from "@/server/auth";
import { sendLeadAcknowledgementEmail, sendLeadAdminAlertEmail } from "@/server/integrations/email";
import { limit } from "@/server/integrations/ratelimit";
import { verifyTurnstileToken } from "@/server/integrations/turnstile";
import { getPublicLeadSettings, normalizeLeadPhone, recordLeadClick, upsertLead } from "@/server/services/leads";

type LeadActionResult = { reference: string };

function clientIp(requestHeaders: Headers): string {
  return (requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim().slice(0, 128).replace(/[^a-zA-Z0-9:._-]/g, "_") || "unknown";
}

function identityKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function submitLeadAction(raw: unknown): Promise<Result<LeadActionResult>> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const parsed = leadFormSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Please review the form fields.", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  if (isLeadHoneypotTripped(input.honeypot)) return err("VALIDATION", "Unable to submit this enquiry.");
  if (Date.now() - input.startedAt < LEAD_FORM_LIMITS.minFillMilliseconds) return err("VALIDATION", "Please take a moment to review your enquiry before sending.");

  let phone: string;
  try { phone = normalizeLeadPhone(input.phone); }
  catch { return err("VALIDATION", "Please enter a valid phone number.", { phone: ["Enter a valid phone number, including country code if outside India."] }); }

  try {
    if (!(await limit(`lead:ip:${ip}`, LEAD_FORM_LIMITS.perIp.max, LEAD_FORM_LIMITS.perIp.windowSeconds)).allowed) return err("RATE_LIMITED", "Too many enquiries. Please try again later.");
    if (!(await limit(`lead:phone:${identityKey(phone)}`, LEAD_FORM_LIMITS.perIdentity.max, LEAD_FORM_LIMITS.perIdentity.windowSeconds)).allowed) return err("RATE_LIMITED", "Too many enquiries. Please try again later.");
    if (input.email) {
      const email = input.email.trim().toLowerCase();
      if (!(await limit(`lead:email:${identityKey(email)}`, LEAD_FORM_LIMITS.perIdentity.max, LEAD_FORM_LIMITS.perIdentity.windowSeconds)).allowed) return err("RATE_LIMITED", "Too many enquiries. Please try again later.");
    }
  } catch {
    return err("UNAVAILABLE", "Enquiry submission is temporarily unavailable.");
  }

  if (!(await verifyTurnstileToken(input.turnstileToken, ip))) return err("VALIDATION", "Please complete the security check.", { turnstileToken: ["Security check failed. Please try again."] });

  try {
    let userId: string | undefined;
    try { userId = (await getSession())?.user?.id; } catch { userId = undefined; }
    const attribution = await getValidatedAttribution(input.attribution, input.pagePath);
    const saved = await upsertLead(input, { attribution, userId });
    if (!saved.duplicate) {
      try {
        const settings = await getPublicLeadSettings();
        const recipients = [...new Set([...settings.notificationRecipients, ...(env.ADMIN_NOTIFY_EMAIL ? [env.ADMIN_NOTIFY_EMAIL] : [])])];
        await Promise.all([
          ...recipients.map((to) => sendLeadAdminAlertEmail({ to, name: input.name, phone, email: input.email || "", reference: saved.reference, formType: input.formType, message: input.message || "" })),
          ...(input.email ? [sendLeadAcknowledgementEmail({ to: input.email, name: input.name, reference: saved.reference })] : []),
        ]);
      } catch {
        console.error("Lead notification delivery failed.");
      }
    }
    return ok({ reference: saved.reference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return message === "LEAD_PHONE_INVALID"
      ? err("VALIDATION", "Please enter a valid phone number.", { phone: ["Enter a valid phone number, including country code if outside India."] })
      : message === "LEAD_PACKAGE_UNAVAILABLE" || message === "LEAD_ACTIVITY_UNAVAILABLE"
        ? err("NOT_FOUND", "This enquiry option is no longer available.")
      : err("UNAVAILABLE", "We could not save your enquiry. Please try again.");
  }
}

export async function recordLeadClickAction(raw: unknown): Promise<Result<{ recorded: true }>> {
  const parsed = leadEventSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid contact event.");
  const requestHeaders = await headers();
  try {
    const ip = clientIp(requestHeaders);
    if (!(await limit(`lead-click:ip:${ip}`, LEAD_FORM_LIMITS.clickEventsPerIp.max, LEAD_FORM_LIMITS.clickEventsPerIp.windowSeconds)).allowed) return err("RATE_LIMITED", "Too many contact attempts.");
    // This public-facing action uses optional authentication rather than requireUser.
    try { await getSession(); } catch { /* Anonymous contact events are allowed. */ }
    await recordLeadClick(parsed.data);
    return ok({ recorded: true });
  } catch {
    return err("UNAVAILABLE", "Contact event could not be recorded.");
  }
}
