import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma, type PublishStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";

export type BatchGalleryItemInput = {
  mediaId: string;
  category: string;
  caption?: string;
  isFeatured?: boolean;
};

export async function batchSaveGalleryItems(
  input: {
    items: BatchGalleryItemInput[];
    status: PublishStatus;
  },
  actorId?: string,
  requestContext?: { ip?: string; userAgent?: string; requestId?: string },
) {
  if (!input.items.length) {
    throw new Error("No media items provided.");
  }

  const mediaIds = input.items.map((i) => i.mediaId);
  const mediaRecords = await db.media.findMany({
    where: { id: { in: mediaIds }, origin: "ADMIN", deletedAt: null },
    select: { id: true, isPublic: true, meta: true, kind: true },
  });

  const mediaMap = new Map(mediaRecords.map((m) => [m.id, m]));
  for (const item of input.items) {
    const found = mediaMap.get(item.mediaId);
    if (!found) {
      throw new Error("One or more media assets are unavailable.");
    }
  }

  const savedItems = await db.$transaction(async (tx) => {
    // 1. Confirm any pending media
    for (const record of mediaRecords) {
      const meta =
        record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
          ? (record.meta as Record<string, unknown>)
          : {};
      const pendingOwned =
        meta.pending === true &&
        meta.pendingById === actorId &&
        typeof meta.pendingUntil === "string" &&
        new Date(meta.pendingUntil) > new Date();

      if (!record.isPublic && pendingOwned) {
        await tx.media.update({
          where: { id: record.id },
          data: { isPublic: true, meta: Prisma.DbNull },
        });
      }
    }

    // 2. Insert GalleryItems and MediaUsage
    const created: Array<{ id: string; mediaId: string }> = [];
    for (const item of input.items) {
      const galleryItem = await tx.galleryItem.create({
        data: {
          mediaId: item.mediaId,
          category: item.category.trim(),
          caption: item.caption?.trim() ? { en: item.caption.trim() } : Prisma.DbNull,
          isFeatured: item.isFeatured ?? false,
          status: input.status,
          publishAt: null,
        },
        select: { id: true, mediaId: true },
      });

      await tx.mediaUsage.create({
        data: {
          mediaId: item.mediaId,
          entityType: "GalleryItem",
          entityId: galleryItem.id,
          field: "gallery",
        },
      });

      created.push(galleryItem);
    }

    return created;
  }, { isolationLevel: "Serializable" });

  if (actorId) {
    await audit({
      actor: { id: actorId, type: "STAFF" },
      action: `cms.gallery-item.batch-create`,
      entityType: "gallery-item",
      entityId: "batch",
      before: null,
      after: { count: savedItems.length, status: input.status, ids: savedItems.map((s) => s.id) },
      ip: requestContext?.ip,
      userAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
    });
  }

  revalidateTag("cms:gallery-item", "max");
  revalidateTag("cms:all", "max");
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/");

  return { count: savedItems.length, ids: savedItems.map((s) => s.id) };
}
