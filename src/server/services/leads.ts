import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { Attribution } from "@/lib/attribution";
import { normalizeLeadPhone } from "@/lib/lead-phone";
import type { LeadFormInput } from "@/lib/schemas/leads";
import { db } from "@/server/db";

export { normalizeLeadPhone } from "@/lib/lead-phone";

function emailValue(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function formToEnquiryType(type: LeadFormInput["formType"]): "GENERAL" | "CONTACT_FORM" | "PACKAGE" | "ACTIVITY" | "CAMP_ORGANISER" | "SCHOOL_GROUP" {
  switch (type) {
    case "QUICK": return "GENERAL";
    case "CONTACT": return "CONTACT_FORM";
    case "PACKAGE": return "PACKAGE";
    case "ACTIVITY": return "ACTIVITY";
    case "CAMP_ORGANISER": return "CAMP_ORGANISER";
    case "SCHOOL_GROUP": return "SCHOOL_GROUP";
  }
}

function localDate(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

type LeadAttributionData = {
  firstUtmSource: string | null; firstUtmMedium: string | null; firstUtmCampaign: string | null; firstUtmTerm: string | null; firstUtmContent: string | null;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmTerm: string | null; utmContent: string | null;
  firstReferrer: string | null; lastReferrer: string | null; firstLandingPath: string | null; lastLandingPath: string | null;
};

function attributionData(attribution: Attribution): LeadAttributionData {
  const first = attribution.firstTouch;
  const last = attribution.lastTouch;
  return {
    firstUtmSource: first?.utmSource ?? null,
    firstUtmMedium: first?.utmMedium ?? null,
    firstUtmCampaign: first?.utmCampaign ?? null,
    firstUtmTerm: first?.utmTerm ?? null,
    firstUtmContent: first?.utmContent ?? null,
    utmSource: last?.utmSource ?? first?.utmSource ?? null,
    utmMedium: last?.utmMedium ?? first?.utmMedium ?? null,
    utmCampaign: last?.utmCampaign ?? first?.utmCampaign ?? null,
    utmTerm: last?.utmTerm ?? first?.utmTerm ?? null,
    utmContent: last?.utmContent ?? first?.utmContent ?? null,
    firstReferrer: first?.referrer ?? null,
    lastReferrer: last?.referrer ?? first?.referrer ?? null,
    firstLandingPath: first?.landingPath ?? last?.landingPath ?? null,
    lastLandingPath: last?.landingPath ?? first?.landingPath ?? null,
  };
}

async function lockLeadIdentifiers(tx: Prisma.TransactionClient, phone: string, email: string | null, submissionId: string) {
  const keys = [`lead:phone:${phone}`, `lead:submission:${submissionId}`, ...(email ? [`lead:email:${email}`] : [])].sort();
  for (const key of keys) {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }
}

export async function upsertLead(input: LeadFormInput, options: { attribution: Attribution; userId?: string | null }) {
  const phone = normalizeLeadPhone(input.phone);
  const email = emailValue(input.email);
  return db.$transaction(async (tx) => {
    await lockLeadIdentifiers(tx, phone, email, input.submissionId);
    const repeated = await tx.enquiry.findUnique({ where: { idempotencyKey: input.submissionId }, select: { id: true, reference: true, leadId: true } });
    if (repeated) return { id: repeated.id, reference: repeated.reference, leadId: repeated.leadId, duplicate: true };
    const matches = await tx.lead.findMany({
      where: { deletedAt: null, OR: [{ phone }, ...(email ? [{ email }] : [])] },
      orderBy: { createdAt: "asc" },
    });
    const canonical = matches[0];
    const incomingAttribution = attributionData(options.attribution);
    let leadId: string;

    if (!canonical) {
      const lead = await tx.lead.create({
        data: {
          name: input.name,
          phone,
          email,
          ...(options.userId ? { userId: options.userId } : {}),
          source: "website",
          ...incomingAttribution,
        },
      });
      leadId = lead.id;
    } else {
      leadId = canonical.id;
      for (const duplicate of matches.slice(1)) {
        await Promise.all([
          tx.leadEvent.updateMany({ where: { leadId: duplicate.id }, data: { leadId } }),
          tx.leadNote.updateMany({ where: { leadId: duplicate.id }, data: { leadId } }),
          tx.enquiry.updateMany({ where: { leadId: duplicate.id }, data: { leadId } }),
          tx.booking.updateMany({ where: { leadId: duplicate.id }, data: { leadId } }),
        ]);
        await tx.lead.update({ where: { id: duplicate.id }, data: { status: "CLOSED", closeReason: "DUPLICATE" } });
      }
      const data: Prisma.LeadUpdateInput = {
        name: input.name || canonical.name,
        phone,
        email: email ?? canonical.email,
        ...(options.userId && !canonical.userId ? { user: { connect: { id: options.userId } } } : {}),
        firstUtmSource: canonical.firstUtmSource ?? incomingAttribution.firstUtmSource,
        firstUtmMedium: canonical.firstUtmMedium ?? incomingAttribution.firstUtmMedium,
        firstUtmCampaign: canonical.firstUtmCampaign ?? incomingAttribution.firstUtmCampaign,
        firstUtmTerm: canonical.firstUtmTerm ?? incomingAttribution.firstUtmTerm,
        firstUtmContent: canonical.firstUtmContent ?? incomingAttribution.firstUtmContent,
        firstReferrer: canonical.firstReferrer ?? incomingAttribution.firstReferrer,
        firstLandingPath: canonical.firstLandingPath ?? incomingAttribution.firstLandingPath,
        utmSource: incomingAttribution.utmSource ?? canonical.utmSource,
        utmMedium: incomingAttribution.utmMedium ?? canonical.utmMedium,
        utmCampaign: incomingAttribution.utmCampaign ?? canonical.utmCampaign,
        utmTerm: incomingAttribution.utmTerm ?? canonical.utmTerm,
        utmContent: incomingAttribution.utmContent ?? canonical.utmContent,
        lastReferrer: incomingAttribution.lastReferrer ?? canonical.lastReferrer,
        lastLandingPath: incomingAttribution.lastLandingPath ?? canonical.lastLandingPath,
      };
      await tx.lead.update({ where: { id: canonical.id }, data });
    }

    if (input.formType === "PACKAGE" && input.packageId && !(await tx.package.findFirst({ where: { id: input.packageId, status: "PUBLISHED", deletedAt: null }, select: { id: true } }))) throw new Error("LEAD_PACKAGE_UNAVAILABLE");
    if (input.formType === "ACTIVITY" && input.activityId && !(await tx.activity.findFirst({ where: { id: input.activityId, status: "PUBLISHED", deletedAt: null }, select: { id: true } }))) throw new Error("LEAD_ACTIVITY_UNAVAILABLE");
    const sequenceRows = await tx.$queryRaw<Array<{ value: bigint }>>(Prisma.sql`SELECT nextval('"enquiry_reference_seq"') AS value`);
    const sequence = Number(sequenceRows[0]?.value);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999_999) throw new Error("ENQUIRY_REFERENCE_SEQUENCE_EXHAUSTED");
    const reference = `ENQ-${new Date().getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
    const enquiry = await tx.enquiry.create({
      data: {
        reference,
        leadId,
        type: formToEnquiryType(input.formType),
        packageId: input.packageId,
        activityId: input.activityId,
        message: input.message || null,
        preferredStart: localDate(input.preferredStart),
        preferredEnd: localDate(input.preferredEnd),
        groupSize: input.groupSize,
        consentToContact: input.consentToContact,
        pagePath: input.pagePath,
        idempotencyKey: input.submissionId,
      },
    });
    await tx.leadEvent.create({
      data: {
        leadId,
        type: "FORM_SUBMIT",
        path: input.pagePath,
        meta: { formType: input.formType, enquiryReference: reference },
      },
    });
    return { id: enquiry.id, reference, leadId, duplicate: false };
  }, { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 10_000 });
}

export async function recordLeadClick(input: { type: "WHATSAPP_CLICK" | "CALL_CLICK"; path: string; anonymousId: string }) {
  return db.leadEvent.create({
    data: { type: input.type, path: input.path, anonymousId: input.anonymousId, meta: { source: "public-contact-cta" } },
  });
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function getPublicLeadSettings() {
  return unstable_cache(async () => {
  const keys = ["business.phones", "business.address", "whatsapp.number", "whatsapp.defaultMessage", "notify.recipients"];
  const rows = await db.setting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  const settings = new Map(rows.map((row) => [row.key, row.value]));
  const phoneValue = settings.get("business.phones");
  const rawPhones = Array.isArray(phoneValue) ? phoneValue.filter((value): value is string => typeof value === "string") : typeof phoneValue === "string" ? phoneValue.split(/\r?\n/) : [];
  const phones = rawPhones.flatMap((value) => { try { return [normalizeLeadPhone(value)]; } catch { return []; } });
  const recipientsValue = settings.get("notify.recipients");
  const recipients = (Array.isArray(recipientsValue) ? recipientsValue.filter((value): value is string => typeof value === "string") : typeof recipientsValue === "string" ? recipientsValue.split(/\r?\n/) : []).flatMap((value) => {
    const parsed = z.string().email().safeParse(value.trim());
    return parsed.success ? [parsed.data.toLowerCase()] : [];
  });
  const defaultMessage = jsonRecord(settings.get("whatsapp.defaultMessage"));
  const address = jsonRecord(settings.get("business.address"));
  let whatsappNumber = "";
  try { whatsappNumber = normalizeLeadPhone(jsonString(settings.get("whatsapp.number"))); } catch { whatsappNumber = ""; }
  return {
    phones,
    address: jsonString(address.en),
    whatsappNumber,
    whatsappMessage: jsonString(defaultMessage.en),
    notificationRecipients: recipients,
  };
  }, ["public-lead-settings"], { tags: ["cms:settings"], revalidate: 300 })();
}

export async function getPublishedLeadTarget(type: "PACKAGE" | "ACTIVITY", id: string) {
  if (type === "PACKAGE") return db.package.findFirst({ where: { id, status: "PUBLISHED", deletedAt: null }, select: { id: true } });
  return db.activity.findFirst({ where: { id, status: "PUBLISHED", deletedAt: null }, select: { id: true } });
}

export async function getPublishedLeadTargetBySlug(type: "PACKAGE" | "ACTIVITY", slug: string) {
  if (type === "PACKAGE") return db.package.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true, name: true } });
  return db.activity.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true, name: true } });
}
