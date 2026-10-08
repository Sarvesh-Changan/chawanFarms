import "server-only";

import type { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { settingsFormSchema } from "@/lib/schemas/cms/settings";
import { db } from "@/server/db";

export type CmsSettings = z.input<typeof settingsFormSchema>;
export type CmsSettingsData = z.output<typeof settingsFormSchema>;

function recordValue(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function localizedValue(value: Prisma.JsonValue | null | undefined): { en: string; mr: string; hi: string } {
  const record = recordValue(value);
  return {
    en: typeof record?.en === "string" ? record.en : "",
    mr: typeof record?.mr === "string" ? record.mr : "",
    hi: typeof record?.hi === "string" ? record.hi : "",
  };
}

function stringValue(value: Prisma.JsonValue | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function socialLinkValues(value: Prisma.JsonValue | null | undefined): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, Prisma.JsonValue>;
    return typeof record.label === "string" && typeof record.url === "string"
      ? [{ label: record.label, url: record.url }]
      : [];
  });
}

function numberString(value: Prisma.JsonValue | null | undefined): string {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : "";
}

export async function getCmsSettings(): Promise<CmsSettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: [
      "business.name", "business.phones", "business.email", "business.address", "business.socialLinks",
      "whatsapp.number", "whatsapp.defaultMessage", "booking.minLeadTimeHours", "booking.minimumGroupSize",
      "booking.checkInTime", "booking.checkOutTime", "booking.policyText", "notify.recipients",
    ] } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    businessName: localizedValue(values.get("business.name")),
    businessPhones: stringList(values.get("business.phones")).join("\n"),
    businessEmail: stringValue(values.get("business.email")),
    address: localizedValue(values.get("business.address")),
    socialLinks: socialLinkValues(values.get("business.socialLinks")),
    whatsappNumber: stringValue(values.get("whatsapp.number")),
    whatsappDefaultMessage: localizedValue(values.get("whatsapp.defaultMessage")),
    minLeadTimeHours: numberString(values.get("booking.minLeadTimeHours")),
    minimumGroupSize: numberString(values.get("booking.minimumGroupSize")),
    checkInTime: stringValue(values.get("booking.checkInTime")),
    checkOutTime: stringValue(values.get("booking.checkOutTime")),
    bookingPolicyText: localizedValue(values.get("booking.policyText")),
    notificationRecipients: stringList(values.get("notify.recipients")).join("\n"),
  };
}

function settingJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null || value === "" ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

export async function saveCmsSettings(data: CmsSettingsData, actorId: string) {
  const settings: Array<{ key: string; value: unknown }> = [
    { key: "business.name", value: data.businessName },
    { key: "business.phones", value: data.businessPhones },
    { key: "business.email", value: data.businessEmail },
    { key: "business.address", value: data.address },
    { key: "business.socialLinks", value: data.socialLinks },
    { key: "whatsapp.number", value: data.whatsappNumber },
    { key: "whatsapp.defaultMessage", value: data.whatsappDefaultMessage },
    { key: "booking.minLeadTimeHours", value: data.minLeadTimeHours },
    { key: "booking.minimumGroupSize", value: data.minimumGroupSize },
    { key: "booking.checkInTime", value: data.checkInTime },
    { key: "booking.checkOutTime", value: data.checkOutTime },
    { key: "booking.policyText", value: data.bookingPolicyText },
    { key: "notify.recipients", value: data.notificationRecipients },
  ];
  await db.$transaction(settings.map(({ key, value }) => db.setting.upsert({
    where: { key },
    create: { key, value: settingJson(value) as Prisma.InputJsonValue, updatedById: actorId },
    update: { value: settingJson(value), updatedById: actorId },
  })));
  return { updatedKeys: settings.map(({ key }) => key) };
}

