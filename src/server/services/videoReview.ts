import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { VIDEO_PREVIEW_TTL_SECONDS, VIDEO_REVIEW_BOOKING_MATCH_DAYS, videoReviewSla } from "@/config/moderation";
import { Prisma, type PrismaClient, type VideoStatus } from "@/generated/prisma/client";
import { maskEmail } from "@/lib/mask";
import { err, ok, type Result } from "@/lib/result";
import { db } from "@/server/db";
import {
  copyAuthenticatedVideoToPublic,
  createAuthenticatedVideoPreviewUrl,
  deleteCloudinaryAsset,
} from "@/server/integrations/cloudinary";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { reverseEntry, earnPointsForApprovedVideo, type DbOrTx } from "@/server/services/rewards";

const idSchema = (label: string) => z.string().uuid(label);

const pageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  status: z.enum(["ALL", "UPLOADING", "PENDING", "APPROVED", "REJECTED", "REMOVED"]).default("PENDING"),
  duplicatesOnly: z.boolean().default(false),
  customerSearch: z.string().trim().max(100).optional(),
}).strict();

const submissionIdSchema = idSchema("Invalid submission id.");
const actionKey = z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/);

const approveSchema = z.object({
  submissionId: submissionIdSchema,
  idempotencyKey: actionKey,
  override: z.boolean().default(false),
  overrideNote: z.string().trim().max(1_000).optional(),
  duplicateAcknowledged: z.boolean().default(false),
}).strict();

const rejectSchema = z.object({
  submissionId: submissionIdSchema,
  idempotencyKey: actionKey,
  reason: z.string().trim().min(1).max(2_000),
}).strict();

const removeSchema = z.object({
  submissionId: submissionIdSchema,
  idempotencyKey: actionKey,
  reason: z.string().trim().min(1).max(2_000),
  reversePoints: z.boolean().default(false),
  reversalReason: z.string().trim().max(2_000).optional(),
}).strict();

const featureSchema = z.object({ submissionId: submissionIdSchema, idempotencyKey: actionKey }).strict();
const previewSchema = z.object({ submissionId: submissionIdSchema }).strict();

export type ReviewQueueInput = z.infer<typeof pageSchema>;
export type ReviewQueueRow = {
  id: string;
  status: VideoStatus;
  title: string | null;
  visitDate: string | null;
  submittedAt: string;
  createdAt: string;
  customer: { id: string; name: string | null; maskedEmail: string };
  media: { format: string | null; bytes: number | null; durationSec: number | null } | null;
  duplicate: boolean;
  duplicateOfId: string | null;
  sla: ReturnType<typeof videoReviewSla>;
};

type ReviewClient = PrismaClient | Prisma.TransactionClient;

function runWithTx<T>(client: ReviewClient, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  if ("$transaction" in client && typeof client.$transaction === "function") return client.$transaction(fn);
  return fn(client as Prisma.TransactionClient);
}

function safeJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function recordAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  const result = await audit({
    actor: { id: actorId, type: "STAFF" },
    action,
    entityType: "VideoSubmission",
    entityId,
    before,
    after,
  }, tx);
  if (!result.ok) throw new Error(result.error.message);
}

async function notifyCustomer(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string },
  template: string,
  title: string,
  body: string,
  submissionId: string,
) {
  await tx.notification.create({
    data: { userId: user.id, type: template, title, body, link: "/account/videos" },
  });
  await tx.notificationOutbox.create({
    data: {
      channel: "EMAIL",
      to: user.email,
      template: template === "video.approved" ? "VIDEO_APPROVED" : template === "video.rejected" ? "VIDEO_REJECTED" : "VIDEO_REMOVED",
      payload: safeJson({ submissionId, title, body, reason: body }),
    },
  });
}

async function lockSubmission(tx: Prisma.TransactionClient, submissionId: string) {
  await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "VideoSubmission" WHERE "id" = ${submissionId} FOR UPDATE
  `);
  return tx.videoSubmission.findUnique({
    where: { id: submissionId },
    include: { user: { select: { id: true, email: true, name: true } }, media: true },
  });
}

async function lockCustomerProfile(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "CustomerProfile" WHERE "userId" = ${userId} FOR UPDATE
  `);
}

function isOwnerOrSuperAdmin(roleNames: readonly string[]) {
  return roleNames.includes("Owner/Manager") || roleNames.includes("Super Admin");
}

export async function listVideoReviewQueue(rawInput: unknown): Promise<Result<{
  rows: ReviewQueueRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}>> {
  const parsed = pageSchema.safeParse(rawInput ?? {});
  if (!parsed.success) return err("VALIDATION", "Invalid video queue filters.", parsed.error.flatten().fieldErrors);
  const { page, pageSize, status, duplicatesOnly, customerSearch } = parsed.data;
  const where: Prisma.VideoSubmissionWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(duplicatesOnly ? { duplicateOfId: { not: null } } : {}),
    ...(customerSearch ? {
      user: { OR: [
        { name: { contains: customerSearch, mode: "insensitive" } },
        { email: { contains: customerSearch, mode: "insensitive" } },
      ] },
    } : {}),
  };
  const [total, submissions] = await Promise.all([
    db.videoSubmission.count({ where }),
    db.videoSubmission.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
        media: { select: { format: true, bytes: true, durationSec: true } },
      },
    }),
  ]);
  const rows = submissions.map((submission) => {
    const submittedAt = submission.submittedAt ?? submission.createdAt;
    return {
      id: submission.id,
      status: submission.status,
      title: submission.title,
      visitDate: submission.visitDate?.toISOString().slice(0, 10) ?? null,
      submittedAt: submittedAt.toISOString(),
      createdAt: submission.createdAt.toISOString(),
      customer: { id: submission.user.id, name: submission.user.name, maskedEmail: maskEmail(submission.user.email) },
      media: submission.media,
      duplicate: Boolean(submission.duplicateOfId),
      duplicateOfId: submission.duplicateOfId,
      sla: videoReviewSla(submittedAt),
    } satisfies ReviewQueueRow;
  });
  return ok({ rows, total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
}

export async function getVideoReviewDetail(rawSubmissionId: unknown): Promise<Result<{
  submission: ReviewQueueRow & { description: string | null; consentPublish: boolean; contentHash: string | null };
  duplicateMatches: Array<{ id: string; status: VideoStatus; createdAt: string }>;
  customerHistory: Array<{ id: string; status: VideoStatus; createdAt: string; pointsAwarded: number | null }>;
  bookings: Array<{ reference: string; status: string; checkIn: string; checkOut: string }>;
}>> {
  const parsed = submissionIdSchema.safeParse(rawSubmissionId);
  if (!parsed.success) return err("VALIDATION", "Invalid video submission.");
  const submission = await db.videoSubmission.findUnique({
    where: { id: parsed.data },
    include: {
      user: { select: { id: true, name: true, email: true, profile: { select: { phone: true } } } },
      media: { select: { format: true, bytes: true, durationSec: true } },
    },
  });
  if (!submission) return err("NOT_FOUND", "Video submission not found.");
  const visitDate = submission.visitDate ?? new Date();
  const from = new Date(visitDate.getTime() - VIDEO_REVIEW_BOOKING_MATCH_DAYS * 86_400_000);
  const to = new Date(visitDate.getTime() + VIDEO_REVIEW_BOOKING_MATCH_DAYS * 86_400_000);
  const [matches, history, bookings] = await Promise.all([
    submission.contentHash ? db.videoSubmission.findMany({
      where: { contentHash: submission.contentHash, id: { not: submission.id } },
      select: { id: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }) : Promise.resolve([]),
    db.videoSubmission.findMany({
      where: { userId: submission.userId },
      select: { id: true, status: true, createdAt: true, pointsAwarded: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "COMPLETED"] },
        checkIn: { gte: from, lte: to },
        OR: [
          { userId: submission.userId },
          ...(submission.user.email ? [{ contactEmail: { equals: submission.user.email, mode: "insensitive" as const } }] : []),
          ...(submission.user.profile?.phone ? [{ contactPhone: submission.user.profile.phone }] : []),
        ],
      },
      select: { reference: true, status: true, checkIn: true, checkOut: true },
      orderBy: { checkIn: "asc" },
      take: 50,
    }),
  ]);
  const submittedAt = submission.submittedAt ?? submission.createdAt;
  return ok({
    submission: {
      id: submission.id,
      status: submission.status,
      title: submission.title,
      description: submission.description,
      visitDate: submission.visitDate?.toISOString().slice(0, 10) ?? null,
      submittedAt: submittedAt.toISOString(),
      createdAt: submission.createdAt.toISOString(),
      customer: { id: submission.user.id, name: submission.user.name, maskedEmail: maskEmail(submission.user.email) },
      media: submission.media,
      duplicate: Boolean(submission.duplicateOfId),
      duplicateOfId: submission.duplicateOfId,
      sla: videoReviewSla(submittedAt),
      consentPublish: submission.consentPublish,
      contentHash: submission.contentHash,
    },
    duplicateMatches: matches.map((match) => ({ id: match.id, status: match.status, createdAt: match.createdAt.toISOString() })),
    customerHistory: history.map((item) => ({ id: item.id, status: item.status, createdAt: item.createdAt.toISOString(), pointsAwarded: item.pointsAwarded })),
    bookings: bookings.map((booking) => ({ reference: booking.reference, status: booking.status, checkIn: booking.checkIn.toISOString().slice(0, 10), checkOut: booking.checkOut.toISOString().slice(0, 10) })),
  });
}

export async function approveVideo(actor: { id: string; roleNames: readonly string[] }, rawInput: unknown, client: DbOrTx = db): Promise<Result<{ submissionId: string; pointsAwarded: number }>> {
  const parsed = approveSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid approval request.", parsed.error.flatten().fieldErrors);
  return runWithTx(client, async (tx) => {
    const submission = await lockSubmission(tx, parsed.data.submissionId);
    if (!submission) return err("NOT_FOUND", "Video submission not found.");
    if (submission.status !== "PENDING") return err("CONFLICT", "This video has already been reviewed.");
    if (submission.userId === actor.id || submission.user.email.toLowerCase() === (await tx.user.findUnique({ where: { id: actor.id }, select: { email: true } }))?.email.toLowerCase()) {
      return err("FORBIDDEN", "A reviewer cannot approve their own customer submission.");
    }
    const rule = await tx.rewardRule.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } });
    if (!rule) return err("REWARDS_DISABLED", "Rewards are currently disabled; this video remains pending.");
    if (submission.contentHash) {
      const approvedDuplicate = await tx.videoSubmission.findFirst({ where: { id: { not: submission.id }, status: "APPROVED", contentHash: submission.contentHash }, select: { id: true } });
      if (approvedDuplicate && (!parsed.data.override || !isOwnerOrSuperAdmin(actor.roleNames) || !parsed.data.overrideNote)) {
        return err("CONFLICT", "This video matches an already approved submission. An Owner or Super Admin override note is required.");
      }
      const flaggedDuplicate = await tx.videoSubmission.findFirst({ where: { id: { not: submission.id }, contentHash: submission.contentHash }, select: { id: true } });
      if (flaggedDuplicate && !parsed.data.duplicateAcknowledged && !approvedDuplicate) {
        return err("CONFLICT", "A possible duplicate is flagged. Acknowledge it before approving.");
      }
      if (approvedDuplicate) {
        await recordAudit(tx, actor.id, "VIDEO_DUPLICATE_OVERRIDE", submission.id, { approvedDuplicateId: approvedDuplicate.id }, { note: parsed.data.overrideNote });
      }
    }
    await lockCustomerProfile(tx, submission.userId);
    const reward = await earnPointsForApprovedVideo({ videoSubmissionId: submission.id, actorId: actor.id }, tx);
    if (!reward.ok) {
      if (reward.error.code === "UNAVAILABLE") return err("REWARDS_DISABLED", reward.error.message);
      return err(reward.error.code === "VALIDATION" ? "CONFLICT" : reward.error.code, reward.error.message);
    }
    const updated = await tx.videoSubmission.updateMany({ where: { id: submission.id, status: "APPROVED", reviewedById: actor.id }, data: { submittedAt: submission.submittedAt ?? new Date() } });
    if (updated.count !== 1) return err("CONFLICT", "This video has already been reviewed.");
    await recordAudit(tx, actor.id, "VIDEO_APPROVED", submission.id, { status: "PENDING" }, { status: "APPROVED", pointsAwarded: reward.data.pointsAwarded, idempotencyKey: parsed.data.idempotencyKey });
    await notifyCustomer(tx, submission.user, "video.approved", "Your video was approved", `Your video submission was approved and ${reward.data.pointsAwarded} points were added.`, submission.id);
    return ok({ submissionId: submission.id, pointsAwarded: reward.data.pointsAwarded });
  });
}

export async function rejectVideo(actorId: string, rawInput: unknown, client: DbOrTx = db): Promise<Result<{ submissionId: string }>> {
  const parsed = rejectSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "A plain-text rejection reason is required.", parsed.error.flatten().fieldErrors);
  return runWithTx(client, async (tx) => {
    const submission = await lockSubmission(tx, parsed.data.submissionId);
    if (!submission) return err("NOT_FOUND", "Video submission not found.");
    if (submission.status !== "PENDING") return err("CONFLICT", "This video has already been reviewed.");
    const updated = await tx.videoSubmission.updateMany({ where: { id: submission.id, status: "PENDING" }, data: { status: "REJECTED", rejectionReason: parsed.data.reason, reviewedById: actorId, reviewedAt: new Date() } });
    if (updated.count !== 1) return err("CONFLICT", "This video has already been reviewed.");
    await recordAudit(tx, actorId, "VIDEO_REJECTED", submission.id, { status: "PENDING" }, { status: "REJECTED", reason: parsed.data.reason, idempotencyKey: parsed.data.idempotencyKey });
    await notifyCustomer(tx, submission.user, "video.rejected", "Your video was not approved", `Reason shown to you: ${parsed.data.reason}`, submission.id);
    return ok({ submissionId: submission.id });
  });
}

export async function removeVideo(actorId: string, rawInput: unknown, client: DbOrTx = db): Promise<Result<{ submissionId: string; reversalRefused: string | null; cloudinaryCleanupPending: boolean }>> {
  const parsed = removeSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "A removal reason is required.", parsed.error.flatten().fieldErrors);
  if (parsed.data.reversePoints && !parsed.data.reversalReason) return err("VALIDATION", "A reversal reason is required.");
  const assets: Array<{ publicId: string; deliveryType: "upload" | "authenticated" }> = [];
  let reversalRefused: string | null = null;
  const result = await runWithTx(client, async (tx) => {
    const submission = await lockSubmission(tx, parsed.data.submissionId);
    if (!submission) return err("NOT_FOUND", "Video submission not found.");
    if (submission.status === "REMOVED") return err("CONFLICT", "This video has already been removed.");
    const usage = await tx.mediaUsage.findFirst({ where: { entityType: "VideoSubmission", entityId: submission.id, field: "featured-copy" }, include: { media: true } });
    if (usage) {
      await tx.galleryItem.updateMany({ where: { mediaId: usage.mediaId, deletedAt: null }, data: { status: "ARCHIVED", isFeatured: false, deletedAt: new Date() } });
      await tx.mediaUsage.delete({ where: { id: usage.id } });
      await tx.media.update({ where: { id: usage.mediaId }, data: { isPublic: false, deletedAt: new Date() } });
      assets.push({ publicId: usage.media.publicId, deliveryType: "upload" });
    }
    if (submission.media) {
      const usages = await tx.mediaUsage.count({ where: { mediaId: submission.media.id } });
      await tx.media.update({ where: { id: submission.media.id }, data: { isPublic: false, ...(usages === 0 ? { deletedAt: new Date() } : {}) } });
      assets.push({ publicId: submission.media.publicId, deliveryType: submission.media.deliveryType === "upload" ? "upload" : "authenticated" });
    }
    if (parsed.data.reversePoints && submission.status === "APPROVED") {
      const entry = await tx.pointsLedger.findFirst({ where: { videoSubmissionId: submission.id, type: "EARN" }, orderBy: { createdAt: "asc" } });
      if (entry) {
        const reversal = await reverseEntry({ ledgerEntryId: entry.id, actorId, reason: parsed.data.reversalReason as string }, tx);
        if (!reversal.ok) reversalRefused = reversal.error.message;
      }
    }
    const updated = await tx.videoSubmission.updateMany({ where: { id: submission.id, status: submission.status }, data: { status: "REMOVED", rejectionReason: parsed.data.reason, reviewedById: actorId, reviewedAt: new Date() } });
    if (updated.count !== 1) return err("CONFLICT", "This video has already been reviewed.");
    await recordAudit(tx, actorId, "VIDEO_REMOVED", submission.id, { status: submission.status }, { status: "REMOVED", reason: parsed.data.reason, reversalRefused, idempotencyKey: parsed.data.idempotencyKey });
    await notifyCustomer(tx, submission.user, "video.removed", "Your video was removed", `Your video submission was removed. Reason: ${parsed.data.reason}`, submission.id);
    return ok({ submissionId: submission.id, reversalRefused, cloudinaryCleanupPending: assets.length > 0 });
  });
  if (!result.ok) return result;
  let cleanupFailed = false;
  for (const asset of assets) {
    const deleted = await deleteCloudinaryAsset({ publicId: asset.publicId, resourceType: "video", deliveryType: asset.deliveryType });
    if (!deleted) cleanupFailed = true;
  }
  return ok({ ...result.data, cloudinaryCleanupPending: cleanupFailed });
}

export async function previewVideo(actorId: string, rawInput: unknown): Promise<Result<{ url: string; expiresInSeconds: number }>> {
  const parsed = previewSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid preview request.");
  try {
    const rate = await limit(`rewards:video-preview:${actorId}`, 30, 60 * 60);
    if (!rate.allowed) return err("RATE_LIMITED", "Preview rate limit reached. Try again later.");
    const submission = await db.videoSubmission.findFirst({ where: { id: parsed.data.submissionId, status: { in: ["PENDING", "APPROVED", "REJECTED"] }, media: { isNot: null } }, select: { id: true, media: { select: { publicId: true, format: true, deliveryType: true } } } });
    if (!submission?.media || submission.media.deliveryType !== "authenticated") return err("NOT_FOUND", "Video preview is unavailable.");
    const url = createAuthenticatedVideoPreviewUrl({ publicId: submission.media.publicId, format: submission.media.format ?? undefined });
    const event = await audit({ actor: { id: actorId, type: "STAFF" }, action: "VIDEO_PREVIEW", entityType: "VideoSubmission", entityId: submission.id });
    if (!event.ok) return err("INTERNAL", "The preview audit event could not be recorded.");
    return ok({ url, expiresInSeconds: VIDEO_PREVIEW_TTL_SECONDS });
  } catch {
    return err("NOT_FOUND", "Video preview is unavailable.");
  }
}

export async function featureOnWebsite(actorId: string, rawInput: unknown, client: DbOrTx = db): Promise<Result<{ galleryItemId: string }>> {
  const parsed = featureSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid feature request.");
  return runWithTx(client, async (tx) => {
    const submission = await lockSubmission(tx, parsed.data.submissionId);
    if (!submission) return err("NOT_FOUND", "Video submission not found.");
    if (submission.status !== "APPROVED" || !submission.consentPublish || !submission.media) return err("FORBIDDEN", "Only approved videos with publish consent can be featured.");
    const existing = await tx.mediaUsage.findFirst({ where: { entityType: "VideoSubmission", entityId: submission.id, field: "featured-copy" } });
    if (existing) {
      const item = await tx.galleryItem.findFirst({ where: { mediaId: existing.mediaId, deletedAt: null }, select: { id: true } });
      if (item) return ok({ galleryItemId: item.id });
    }
    const publicId = `customer-stories/${submission.id}/${randomUUID()}`;
    let copied: Awaited<ReturnType<typeof copyAuthenticatedVideoToPublic>>;
    try {
      copied = await copyAuthenticatedVideoToPublic({ sourcePublicId: submission.media.publicId, targetPublicId: publicId });
    } catch {
      return err("UNAVAILABLE", "The public video copy could not be created.");
    }
    const media = await tx.media.create({ data: { kind: "VIDEO", origin: "CUSTOMER", publicId: copied.publicId, resourceType: "video", deliveryType: "upload", format: copied.format, bytes: copied.bytes, durationSec: copied.durationSec, contentHash: submission.contentHash, isPublic: false, uploadedById: actorId, tags: [] } });
    const galleryItem = await tx.galleryItem.create({ data: { mediaId: media.id, category: "customer-video", caption: submission.title ? { en: submission.title } : undefined, status: "DRAFT", isFeatured: false } });
    await tx.mediaUsage.create({ data: { mediaId: media.id, entityType: "VideoSubmission", entityId: submission.id, field: "featured-copy" } });
    await recordAudit(tx, actorId, "VIDEO_FEATURED_COPY_CREATED", submission.id, null, { galleryItemId: galleryItem.id, mediaId: media.id, idempotencyKey: parsed.data.idempotencyKey });
    return ok({ galleryItemId: galleryItem.id });
  });
}

export async function unfeatureOnWebsite(actorId: string, rawInput: unknown, client: DbOrTx = db): Promise<Result<{ submissionId: string }>> {
  const parsed = z.object({ submissionId: submissionIdSchema, idempotencyKey: actionKey }).strict().safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid unfeature request.");
  const result = await runWithTx(client, async (tx) => {
    const usage = await tx.mediaUsage.findFirst({ where: { entityType: "VideoSubmission", entityId: parsed.data.submissionId, field: "featured-copy" }, include: { media: true } });
    if (!usage) return err("NOT_FOUND", "This video has no website copy.");
    await tx.galleryItem.updateMany({ where: { mediaId: usage.mediaId, deletedAt: null }, data: { status: "ARCHIVED", isFeatured: false, deletedAt: new Date() } });
    await tx.mediaUsage.delete({ where: { id: usage.id } });
    await tx.media.update({ where: { id: usage.mediaId }, data: { isPublic: false, deletedAt: new Date() } });
    await recordAudit(tx, actorId, "VIDEO_UNFEATURED", parsed.data.submissionId, { mediaId: usage.mediaId }, { idempotencyKey: parsed.data.idempotencyKey });
    return ok({ submissionId: parsed.data.submissionId, publicId: usage.media.publicId });
  });
  if (!result.ok) return result;
  const deleted = await deleteCloudinaryAsset({ publicId: result.data.publicId, resourceType: "video", deliveryType: "upload" });
  return ok({ submissionId: result.data.submissionId, ...(deleted ? {} : {}) });
}
