import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { canDeleteMediaWithUsageCount } from "@/lib/media-policy";
import { err, ok, type Result } from "@/lib/result";
import { updateMediaInputSchema } from "@/lib/schemas/media";
import { db } from "@/server/db";
import type { VerifiedCloudinaryAsset } from "@/server/integrations/cloudinary";

const mediaQuerySchema = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(1).max(60).default(24),
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["IMAGE", "VIDEO"]).optional(),
  category: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(40).optional(),
  includeDeleted: z.boolean().default(false),
}).strict();

export type MediaQuery = z.infer<typeof mediaQuerySchema>;

export async function listMedia(rawQuery: MediaQuery) {
  const query = mediaQuerySchema.parse(rawQuery);
  const where: Prisma.MediaWhereInput = {
    ...(query.includeDeleted ? {} : { deletedAt: null }),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.tag ? { tags: { has: query.tag } } : {}),
    ...(query.q ? { OR: [
      { publicId: { contains: query.q, mode: "insensitive" } },
      { category: { contains: query.q, mode: "insensitive" } },
      { caption: { string_contains: query.q } },
      { tags: { has: query.q } },
    ] } : {}),
  };
  const [rows, total, categories, tags] = await Promise.all([
    db.media.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, kind: true, origin: true, publicId: true, resourceType: true,
        deliveryType: true, format: true, bytes: true, width: true, height: true,
        durationSec: true, altText: true, caption: true, focalX: true, focalY: true,
        tags: true, category: true, uploadedById: true, isPublic: true,
        deletedAt: true, createdAt: true,
        usages: { select: { id: true, entityType: true, entityId: true, field: true } },
      },
    }),
    db.media.count({ where }),
    db.media.findMany({ where: { deletedAt: null, category: { not: null } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    db.media.findMany({ where: { deletedAt: null }, select: { tags: true }, take: 250 }),
  ]);
  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    categories: categories.flatMap(({ category }) => category ? [category] : []),
    tags: [...new Set(tags.flatMap(({ tags: rowTags }) => rowTags))].sort(),
  };
}

export async function getMediaDetail(id: string) {
  const parsedId = z.string().uuid().parse(id);
  return db.media.findUnique({
    where: { id: parsedId },
    include: { usages: { orderBy: [{ entityType: "asc" }, { entityId: "asc" }] } },
  });
}

export async function recordVerifiedMedia(asset: VerifiedCloudinaryAsset) {
  const mediaData = {
    kind: asset.kind,
    origin: asset.origin,
    publicId: asset.publicId,
    resourceType: asset.resourceType,
    deliveryType: asset.deliveryType,
    format: asset.format,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
    contentHash: asset.contentHash,
    uploadedById: asset.uploadedById,
  };
  return db.media.upsert({
    where: { publicId: asset.publicId },
    create: mediaData,
    update: {
      kind: asset.kind,
      origin: asset.origin,
      resourceType: asset.resourceType,
      deliveryType: asset.deliveryType,
      format: asset.format,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      durationSec: asset.durationSec,
      uploadedById: asset.uploadedById,
    },
  });
}

export async function updateMedia(rawInput: unknown): Promise<Result<{ id: string }>> {
  const parsed = updateMediaInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please check the media details.");
  const input = parsed.data;
  const existing = await db.media.findUnique({ where: { id: input.id }, select: { id: true, kind: true, origin: true, isPublic: true, altText: true, caption: true, focalX: true, focalY: true, tags: true, category: true, deletedAt: true } });
  if (!existing || existing.deletedAt) return err("NOT_FOUND", "Media not found.");
  if (input.kind !== existing.kind) return err("VALIDATION", "Media kind does not match the stored asset.");
  if (input.isPublic && existing.kind === "IMAGE" && !input.altText.en) {
    return err("VALIDATION", "English alt text is required before publishing an image.", { altText: ["Enter English alt text."] });
  }
  if (input.isPublic && existing.origin === "CUSTOMER") return err("FORBIDDEN", "Customer uploads cannot be published from the media library.");
  try {
    await db.media.update({
      where: { id: input.id },
      data: {
        altText: Object.keys(input.altText).length ? input.altText as Prisma.InputJsonValue : Prisma.DbNull,
        caption: Object.keys(input.caption).length ? input.caption as Prisma.InputJsonValue : Prisma.DbNull,
        focalX: input.focalX,
        focalY: input.focalY,
        tags: input.tags,
        category: input.category || null,
        isPublic: input.isPublic,
      },
    });
    return ok({ id: input.id });
  } catch {
    return err("INTERNAL", "Unable to save media details.");
  }
}

export async function addMediaUsage(rawInput: unknown): Promise<Result<{ id: string }>> {
  const parsed = z.object({ mediaId: z.string().uuid(), entityType: z.string().trim().min(1).max(80), entityId: z.string().trim().min(1).max(120), field: z.string().trim().max(80).nullable().optional() }).strict().safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid media usage reference.");
  try {
    const usage = await db.$transaction(async (transaction) => {
      const media = await transaction.media.findUnique({ where: { id: parsed.data.mediaId }, select: { deletedAt: true } });
      if (!media || media.deletedAt) throw new Error("MEDIA_NOT_AVAILABLE");
      return transaction.mediaUsage.upsert({
        where: { mediaId_entityType_entityId_field: { mediaId: parsed.data.mediaId, entityType: parsed.data.entityType, entityId: parsed.data.entityId, field: parsed.data.field ?? "" } },
        create: { mediaId: parsed.data.mediaId, entityType: parsed.data.entityType, entityId: parsed.data.entityId, field: parsed.data.field ?? "" },
        update: {},
        select: { id: true },
      });
    }, { isolationLevel: "Serializable" });
    return ok(usage);
  } catch (error) {
    if (error instanceof Error && error.message === "MEDIA_NOT_AVAILABLE") return err("NOT_FOUND", "Media not found.");
    return err("CONFLICT", "Unable to record this media usage.");
  }
}

export async function removeMediaUsage(id: string): Promise<Result<{ deleted: true }>> {
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return err("VALIDATION", "Invalid media usage reference.");
  const result = await db.mediaUsage.deleteMany({ where: { id: parsedId.data } });
  return result.count ? ok({ deleted: true }) : err("NOT_FOUND", "Media usage not found.");
}

export async function softDeleteMedia(id: string): Promise<Result<{ id: string }>> {
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return err("VALIDATION", "Invalid media ID.");
  try {
    await db.$transaction(async (transaction) => {
      const media = await transaction.media.findUnique({ where: { id: parsedId.data }, include: { _count: { select: { usages: true } } } });
      if (!media || media.deletedAt) throw new Error("MEDIA_NOT_FOUND");
      if (!canDeleteMediaWithUsageCount(media._count.usages)) throw new Error("MEDIA_IN_USE");
      await transaction.media.update({ where: { id: media.id }, data: { deletedAt: new Date(), isPublic: false } });
    }, { isolationLevel: "Serializable" });
    return ok({ id: parsedId.data });
  } catch (error) {
    if (error instanceof Error && error.message === "MEDIA_NOT_FOUND") return err("NOT_FOUND", "Media not found.");
    if (error instanceof Error && error.message === "MEDIA_IN_USE") return err("CONFLICT", "This media is still in use and cannot be deleted.");
    return err("CONFLICT", "Unable to delete media safely.");
  }
}
