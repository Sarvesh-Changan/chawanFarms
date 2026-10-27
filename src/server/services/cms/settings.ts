import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { SettingsData, SettingsFormValues } from "@/lib/schemas/cms/settings";
import { db } from "@/server/db";
import { deleteCloudinaryAsset } from "@/server/integrations/cloudinary";

export type AdminSettingsMedia = {
  id: string;
  publicId: string;
  format: string | null;
  width: number | null;
  height: number | null;
  altText: unknown;
  tags: string[];
};

export type CmsSettings = SettingsFormValues & { ownerMedia?: AdminSettingsMedia; heroMedia?: AdminSettingsMedia };
export type CmsSettingsData = SettingsData;

function recordValue(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function localizedValue(value: Prisma.JsonValue | null | undefined) {
  const record = recordValue(value);
  return { en: typeof record.en === "string" ? record.en : "", mr: typeof record.mr === "string" ? record.mr : "", hi: typeof record.hi === "string" ? record.hi : "" };
}

function optionalLocalizedValue(value: Prisma.JsonValue | null | undefined) {
  const localized = localizedValue(value);
  return localized.en || localized.mr || localized.hi ? localized : { en: "", mr: "", hi: "" };
}

function phoneValues(value: Prisma.JsonValue | null | undefined): Array<{ number: string; isPrimary: boolean }> {
  if (!Array.isArray(value)) return [];
  const phones = value.flatMap((entry) => {
    if (typeof entry === "string") return [{ number: entry, isPrimary: false }];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    return typeof record.number === "string" ? [{ number: record.number, isPrimary: record.isPrimary === true }] : [];
  });
  const primaryIndex = Math.max(0, phones.findIndex((phone) => phone.isPrimary));
  return phones.map((phone, index) => ({ ...phone, isPrimary: index === primaryIndex }));
}

function urlValue(value: Prisma.JsonValue | null | undefined, kind: string): string {
  if (!Array.isArray(value)) return "";
  const entry = value.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate) && (candidate as Record<string, unknown>).kind === kind) as Record<string, unknown> | undefined;
  return typeof entry?.url === "string" ? entry.url : "";
}

async function settingMedia(id: string | null) {
  if (!id) return undefined;
  return db.media.findFirst({ where: { id, kind: "IMAGE", origin: "ADMIN", deletedAt: null }, select: { id: true, publicId: true, format: true, width: true, height: true, altText: true, tags: true } });
}

export async function getCmsSettings(): Promise<CmsSettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: [
      "business.name", "business.email", "business.phones", "business.address", "business.socialLinks",
      "whatsapp.number", "whatsapp.defaultMessage", "owner.display", "owner.mediaId", "owner.name", "owner.caption",
      "home.hero.headline", "home.hero.subhead", "home.hero.primaryCta", "home.hero.secondaryCta", "home.hero.mediaId", "home.closing.headline",
    ] } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const ownerMediaId = typeof values.get("owner.mediaId") === "string" ? values.get("owner.mediaId") as string : null;
  const heroMediaId = typeof values.get("home.hero.mediaId") === "string" ? values.get("home.hero.mediaId") as string : null;
  const [ownerMedia, heroMedia] = await Promise.all([settingMedia(ownerMediaId), settingMedia(heroMediaId)]);
  return {
    businessName: localizedValue(values.get("business.name")),
    businessEmail: typeof values.get("business.email") === "string" ? values.get("business.email") as string : "",
    phones: phoneValues(values.get("business.phones")),
    whatsappNumber: typeof values.get("whatsapp.number") === "string" ? values.get("whatsapp.number") as string : "",
    whatsappDefaultMessage: optionalLocalizedValue(values.get("whatsapp.defaultMessage")),
    address: localizedValue(values.get("business.address")),
    ownerDisplay: values.get("owner.display") === true,
    ownerMediaId,
    ownerName: typeof values.get("owner.name") === "string" ? values.get("owner.name") as string : "",
    ownerCaption: typeof values.get("owner.caption") === "string" ? values.get("owner.caption") as string : "",
    heroHeadline: typeof values.get("home.hero.headline") === "string" ? values.get("home.hero.headline") as string : "",
    heroSubhead: typeof values.get("home.hero.subhead") === "string" ? values.get("home.hero.subhead") as string : "",
    heroPrimaryCta: typeof values.get("home.hero.primaryCta") === "string" ? values.get("home.hero.primaryCta") as string : "",
    heroSecondaryCta: typeof values.get("home.hero.secondaryCta") === "string" ? values.get("home.hero.secondaryCta") as string : "",
    heroMediaId,
    closingHeadline: typeof values.get("home.closing.headline") === "string" ? values.get("home.closing.headline") as string : "",
    instagramUrl: urlValue(values.get("business.socialLinks"), "instagram"),
    facebookUrl: urlValue(values.get("business.socialLinks"), "facebook"),
    youtubeUrl: urlValue(values.get("business.socialLinks"), "youtube"),
    ...(ownerMedia ? { ownerMedia } : {}),
    ...(heroMedia ? { heroMedia } : {}),
  };
}

function settingJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null || value === "" ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

function mediaMeta(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return recordValue(value);
}

async function cleanupIfUnused(mediaId: string | null | undefined) {
  if (!mediaId) return;
  const media = await db.media.findUnique({ where: { id: mediaId }, include: { usages: true, videoSubmission: true } });
  if (!media || media.origin !== "ADMIN" || media.usages.length || media.videoSubmission) return;
  const deleted = await db.media.updateMany({ where: { id: mediaId, deletedAt: null }, data: { deletedAt: new Date(), isPublic: false } });
  if (deleted.count) await deleteCloudinaryAsset({ publicId: media.publicId, resourceType: media.resourceType === "video" ? "video" : "image", deliveryType: media.deliveryType === "authenticated" ? "authenticated" : "upload" });
}

export async function saveCmsSettings(data: CmsSettingsData, actorId: string) {
  const socialLinks = [
    data.instagramUrl ? { kind: "instagram", label: "Instagram", url: data.instagramUrl } : null,
    data.facebookUrl ? { kind: "facebook", label: "Facebook", url: data.facebookUrl } : null,
    data.youtubeUrl ? { kind: "youtube", label: "YouTube", url: data.youtubeUrl } : null,
  ].filter((value): value is { kind: string; label: string; url: string } => Boolean(value));
  const keys: Array<[string, unknown]> = [
    ["business.name", data.businessName], ["business.email", data.businessEmail], ["business.phones", data.phones], ["business.address", data.address], ["business.socialLinks", socialLinks],
    ["whatsapp.number", data.whatsappNumber], ["whatsapp.defaultMessage", data.whatsappDefaultMessage], ["owner.display", data.ownerDisplay], ["owner.mediaId", data.ownerMediaId], ["owner.name", data.ownerName], ["owner.caption", data.ownerCaption],
    ["home.hero.headline", data.heroHeadline], ["home.hero.subhead", data.heroSubhead], ["home.hero.primaryCta", data.heroPrimaryCta], ["home.hero.secondaryCta", data.heroSecondaryCta], ["home.hero.mediaId", data.heroMediaId], ["home.closing.headline", data.closingHeadline],
  ];
  const oldRows = await db.setting.findMany({ where: { key: { in: ["owner.mediaId", "home.hero.mediaId"] } }, select: { key: true, value: true } });
  const oldMediaIds = oldRows.map((row) => typeof row.value === "string" ? row.value : null);
  await db.$transaction(async (tx) => {
    for (const [key, value] of keys) await tx.setting.upsert({ where: { key }, create: { key, value: settingJson(value), updatedById: actorId }, update: { value: settingJson(value), updatedById: actorId } });
    await tx.mediaUsage.deleteMany({ where: { entityType: "Setting", entityId: "home", field: { in: ["owner", "hero"] } } });
    const selected = [data.ownerMediaId ? { mediaId: data.ownerMediaId, field: "owner" } : null, data.heroMediaId ? { mediaId: data.heroMediaId, field: "hero" } : null].filter((value): value is { mediaId: string; field: string } => Boolean(value));
    for (const item of selected) {
      const media = await tx.media.findFirst({ where: { id: item.mediaId, kind: "IMAGE", origin: "ADMIN", deletedAt: null }, select: { id: true, meta: true } });
      if (!media) throw new Error("SETTINGS_MEDIA_UNAVAILABLE");
      const pending = mediaMeta(media.meta).pending;
      if (pending && mediaMeta(media.meta).pendingById !== actorId) throw new Error("SETTINGS_MEDIA_UNAVAILABLE");
      await tx.media.update({ where: { id: item.mediaId }, data: { isPublic: true, meta: Prisma.DbNull } });
      await tx.mediaUsage.create({ data: { mediaId: item.mediaId, entityType: "Setting", entityId: "home", field: item.field } });
    }
  }, { isolationLevel: "Serializable" });
  for (const oldId of oldMediaIds) if (oldId && oldId !== data.ownerMediaId && oldId !== data.heroMediaId) await cleanupIfUnused(oldId);
  return { updatedKeys: keys.map(([key]) => key) };
}
