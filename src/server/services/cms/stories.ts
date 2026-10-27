import "server-only";

import { Prisma, type PublishStatus, type StoryKind } from "@/generated/prisma/client";
import type { StoryFormData } from "@/lib/schemas/cms/stories";
import { sanitizeLocalizedHtml } from "@/server/cms/html";
import { db } from "@/server/db";
import { cleanupUnusedAdminMedia } from "@/server/services/media";

const mediaSelect = {
  id: true,
  publicId: true,
  kind: true,
  format: true,
  bytes: true,
  width: true,
  height: true,
  durationSec: true,
  altText: true,
  caption: true,
  tags: true,
  isPublic: true,
} as const;

function localizedHtml(value: unknown): Prisma.InputJsonValue { return sanitizeLocalizedHtml(value) as Prisma.InputJsonValue; }
function requiredJson(value: unknown): Prisma.InputJsonValue { return value as Prisma.InputJsonValue; }
function nullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput { return value === undefined ? Prisma.DbNull : value as Prisma.InputJsonValue; }

function mediaMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function ensureMedia(
  tx: Prisma.TransactionClient,
  id: string | null | undefined,
  kind: "IMAGE" | "VIDEO",
  actorId: string,
) {
  if (!id) return null;
  const media = await tx.media.findFirst({ where: { id, kind, origin: "ADMIN", deletedAt: null }, select: { id: true, isPublic: true, meta: true } });
  const meta = mediaMeta(media?.meta);
  const pendingOwned = meta.pending === true && meta.pendingById === actorId && typeof meta.pendingUntil === "string" && new Date(meta.pendingUntil) > new Date();
  if (!media || (!media.isPublic && !pendingOwned)) throw new Error("STORY_MEDIA_UNAVAILABLE");
  if (pendingOwned) await tx.media.update({ where: { id: media.id }, data: { isPublic: true, meta: Prisma.DbNull } });
  return media.id;
}

async function mediaIdsForStory(story: { coverMediaId: string | null; videoMediaId: string | null; photoMediaIds: Prisma.JsonValue | null }) {
  const photos = Array.isArray(story.photoMediaIds) ? story.photoMediaIds.filter((value): value is string => typeof value === "string") : [];
  return [...new Set([story.coverMediaId, story.videoMediaId, ...photos].filter((id): id is string => Boolean(id)))];
}

export async function getStoryAdmin(id: string) {
  const story = await db.post.findUnique({ where: { id }, include: { sourceSubmission: { select: { id: true, status: true, consentPublish: true } } } });
  if (!story) return null;
  const ids = await mediaIdsForStory(story);
  const media = await db.media.findMany({ where: { id: { in: ids } }, select: mediaSelect });
  return { ...story, media };
}

export async function listStoriesAdmin(input: { q: string; status: "ALL" | PublishStatus; kind: "ALL" | StoryKind; trash: boolean }) {
  const where: Prisma.PostWhereInput = {
    deletedAt: input.trash ? { not: null } : null,
    ...(input.status !== "ALL" ? { status: input.status } : {}),
    ...(input.kind !== "ALL" ? { kind: input.kind } : {}),
    ...(input.q ? { OR: [
      { slug: { contains: input.q, mode: "insensitive" } },
      { title: { path: ["en"], string_contains: input.q, mode: "insensitive" } },
      { excerpt: { path: ["en"], string_contains: input.q, mode: "insensitive" } },
    ] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.post.findMany({ where, orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }], include: { sourceSubmission: { select: { id: true, status: true, consentPublish: true } } }, take: 500 }),
    db.post.count({ where }),
  ]);
  return { rows, total };
}

export async function saveStory(input: StoryFormData, actorId: string) {
  const before = input.id ? await getStoryAdmin(input.id) : null;
  const previousIds = before ? await mediaIdsForStory(before) : [];
  const photoIds = input.photoMediaIds ?? [];
  const saved = await db.$transaction(async (tx) => {
    const coverMediaId = await ensureMedia(tx, input.coverMediaId || null, "IMAGE", actorId);
    const videoMediaId = await ensureMedia(tx, input.videoMediaId || null, "VIDEO", actorId);
    for (const photoId of photoIds) await ensureMedia(tx, photoId, "IMAGE", actorId);
    const body = input.body ? localizedHtml(input.body) : { en: "" } as Prisma.InputJsonValue;
    const data = {
      slug: input.slug,
      title: requiredJson(input.title),
      excerpt: nullableJson(input.summary),
      body,
      coverMediaId,
      kind: input.kind,
      videoMediaId,
      photoMediaIds: requiredJson(photoIds),
      featured: input.featured,
      ...(input.id ? {} : { status: "DRAFT" as const, publishAt: null }),
    };
    const story = input.id
      ? await tx.post.update({ where: { id: input.id }, data })
      : await tx.post.create({ data });
    await tx.mediaUsage.deleteMany({ where: { entityType: "Post", entityId: story.id } });
    if (coverMediaId) await tx.mediaUsage.create({ data: { mediaId: coverMediaId, entityType: "Post", entityId: story.id, field: "cover" } });
    if (videoMediaId) await tx.mediaUsage.create({ data: { mediaId: videoMediaId, entityType: "Post", entityId: story.id, field: "video" } });
    for (const photoId of photoIds) await tx.mediaUsage.create({ data: { mediaId: photoId, entityType: "Post", entityId: story.id, field: "photo" } });
    return story;
  }, { isolationLevel: "Serializable" });
  const nextIds = [...new Set([input.coverMediaId, input.videoMediaId, ...photoIds].filter((id): id is string => Boolean(id)))];
  for (const id of previousIds) if (!nextIds.includes(id)) await cleanupUnusedAdminMedia(id);
  return { before, saved };
}

export async function setStoryStatus(id: string, status: PublishStatus, publishAt: Date | null) {
  const story = await db.post.findUnique({ where: { id }, include: { sourceSubmission: { select: { status: true, consentPublish: true } }, videoMedia: { select: { isPublic: true, deletedAt: true } } } });
  if (!story || story.deletedAt) throw new Error("STORY_NOT_FOUND");
  if ((status === "PUBLISHED" || status === "SCHEDULED") && story.kind === "GUEST" && (!story.sourceSubmission || story.sourceSubmission.status !== "APPROVED" || !story.sourceSubmission.consentPublish)) throw new Error("STORY_GUEST_CONSENT_REQUIRED");
  if ((status === "PUBLISHED" || status === "SCHEDULED") && story.videoMediaId && (!story.videoMedia || !story.videoMedia.isPublic || story.videoMedia.deletedAt)) throw new Error("STORY_VIDEO_UNAVAILABLE");
  return db.post.update({ where: { id }, data: { status, publishAt: status === "SCHEDULED" ? publishAt : null } });
}

export async function softDeleteStory(id: string) {
  const story = await db.post.findFirst({ where: { id, deletedAt: null } });
  if (!story) return null;
  const mediaIds = await mediaIdsForStory(story);
  const saved = await db.$transaction(async (tx) => {
    const updated = await tx.post.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
    await tx.mediaUsage.deleteMany({ where: { entityType: "Post", entityId: id } });
    return updated;
  });
  for (const mediaId of mediaIds) await cleanupUnusedAdminMedia(mediaId);
  return saved;
}

export async function restoreStory(id: string) {
  return db.post.update({ where: { id }, data: { deletedAt: null, status: "DRAFT", publishAt: null } });
}

export async function reorderStory(id: string, direction: "up" | "down") {
  return db.$transaction(async (tx) => {
    const rows = await tx.post.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
    const index = rows.findIndex((row) => row.id === id);
    const target = index + (direction === "up" ? -1 : 1);
    if (index < 0 || target < 0 || target >= rows.length) return { moved: false };
    const reordered = [...rows];
    const moving = reordered.splice(index, 1)[0];
    if (!moving) return { moved: false };
    reordered.splice(target, 0, moving);
    await Promise.all(reordered.map((row, sortOrder) => tx.post.update({ where: { id: row.id }, data: { sortOrder } })));
    return { moved: true };
  }, { isolationLevel: "Serializable" });
}

