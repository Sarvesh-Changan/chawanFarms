import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { env } from "@/config/env";
import {
  CUSTOMER_UPLOAD_RATE_LIMIT,
  VIDEO_DAILY_SUBMISSION_LIMIT,
  VIDEO_PENDING_SUBMISSION_LIMIT,
  VIDEO_UPLOAD_INTENT_TTL_SECONDS,
  mediaPolicy,
} from "@/config/media";
import { Prisma } from "@/generated/prisma/client";
import { err, ok, type Result } from "@/lib/result";
import { db } from "@/server/db";
import {
  createUploadSignature,
  deleteCloudinaryAsset,
  verifyCloudinaryAsset,
} from "@/server/integrations/cloudinary";
import { limit } from "@/server/integrations/ratelimit";

const userIdSchema = z.string().trim().min(1).max(128);
const submissionIdSchema = z.string().uuid();
const idempotencyKeySchema = z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Visit date must use YYYY-MM-DD.");

const startUploadSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  visitDate: dateSchema,
  title: z.string().trim().max(160).optional().transform((value) => value || null),
  description: z.string().trim().max(2_000).optional().transform((value) => value || null),
  consentOwnership: z.literal(true),
  consentPublish: z.boolean().default(false),
  resume: z.boolean().optional(),
}).strict();

const completeUploadSchema = z.object({ submissionId: submissionIdSchema }).strict();
const withdrawSubmissionSchema = z.object({ submissionId: submissionIdSchema }).strict();

export type StartUploadInput = z.infer<typeof startUploadSchema>;

type UploadSignature = ReturnType<typeof createUploadSignature>;

type UploadIntent = {
  id: string;
  userId: string;
  uploadPublicId: string;
  uploadExpiresAt: Date;
  status: "UPLOADING";
};

function deterministicAssetId(userId: string, idempotencyKey: string): string {
  const hex = createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function uploadPublicId(userId: string, assetId: string): string {
  return `${mediaPolicy("customer_video").folder(userId)}/${assetId}`;
}

function uploadSignature(userId: string, assetId: string): UploadSignature {
  const webhookUrl = new URL("/api/webhooks/cloudinary", env.NEXT_PUBLIC_SITE_URL).toString();
  return createUploadSignature({
    purpose: "customer_video",
    userId,
    assetId,
    webhookUrl,
  });
}

async function lockProfile(transaction: Prisma.TransactionClient, userId: string) {
  let profile = await transaction.customerProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await transaction.customerProfile.create({
      data: {
        userId,
        referralCode: `CF${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`,
        pointsBalance: 0,
        lifetimePointsEarned: 0,
      },
    });
  }
  await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "CustomerProfile" WHERE "userId" = ${userId} FOR UPDATE
  `);
  return profile;
}

async function removeCloudinaryAsset(publicId: string): Promise<void> {
  try {
    await deleteCloudinaryAsset({ publicId, resourceType: "video", deliveryType: "authenticated" });
  } catch {
    // The database state is still made terminal so a failed cleanup cannot
    // leave an upload intent looking resumable.
  }
}

function visitDateIsValid(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  const todayInKolkata = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return value <= todayInKolkata;
}

async function checkAccountEligibility(transaction: Prisma.TransactionClient, userId: string): Promise<Result<true>> {
  const account = await transaction.user.findUnique({
    where: { id: userId },
    select: { type: true, status: true, emailVerified: true, deletedAt: true },
  });
  if (!account || account.deletedAt || account.status !== "ACTIVE" || account.type !== "CUSTOMER") {
    return err("ACCOUNT_INELIGIBLE", "A verified customer account is required to upload videos.");
  }
  if (!account.emailVerified) {
    return err("EMAIL_NOT_VERIFIED", "Please verify your email first.");
  }
  return ok(true);
}

export type StartUploadResult = {
  submissionId: string;
  uploadPublicId: string;
  uploadExpiresAt: string;
  signature: UploadSignature;
};

export async function startUpload(userId: string, rawInput: unknown): Promise<Result<StartUploadResult>> {
  const parsedUserId = userIdSchema.safeParse(userId);
  const parsed = startUploadSchema.safeParse(rawInput);
  if (!parsedUserId.success || !parsed.success) {
    return err("VALIDATION", "Please check the video submission details.", parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  }
  if (!visitDateIsValid(parsed.data.visitDate)) {
    return err("VALIDATION", "Visit date must be a real date and cannot be in the future.", { visitDate: ["Enter a valid past or current date."] });
  }

  try {
    const rate = await limit(`media:signature:user:${parsedUserId.data}`, CUSTOMER_UPLOAD_RATE_LIMIT.max, CUSTOMER_UPLOAD_RATE_LIMIT.windowSeconds);
    if (!rate.allowed) return err("RATE_LIMITED", "Upload limit reached. Try again later.", { retryAfter: 3600 });
  } catch {
    return err("SERVICE_UNAVAILABLE", "Upload service is temporarily unavailable. Please try again shortly.");
  }

  const assetId = deterministicAssetId(parsedUserId.data, parsed.data.idempotencyKey);
  const publicId = uploadPublicId(parsedUserId.data, assetId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VIDEO_UPLOAD_INTENT_TTL_SECONDS * 1000);

  try {
    return await db.$transaction(async (transaction) => {
      const eligibility = await checkAccountEligibility(transaction, parsedUserId.data);
      if (!eligibility.ok) return eligibility;

      const profile = await lockProfile(transaction, parsedUserId.data);
      if (!profile) return err("ACCOUNT_INELIGIBLE", "Customer profile is unavailable.");

      const activeRule = await transaction.rewardRule.findFirst({
        where: { isActive: true },
        select: { id: true, maxSubmissionsPerPeriod: true, periodDays: true },
        orderBy: { version: "desc" },
      });
      if (!activeRule) {
        return err("REWARDS_DISABLED", "Video reward submissions are currently paused. Please check back later.");
      }

      // Lazily expire stale UPLOADING rows (>1 hour) for this user so they never block new submissions
      await transaction.videoSubmission.updateMany({
        where: {
          userId: parsedUserId.data,
          status: "UPLOADING",
          uploadExpiresAt: { lte: now },
        },
        data: {
          status: "REMOVED",
          rejectionReason: "Upload intent expired.",
        },
      });

      // Check if this exact idempotency key was already created
      const existing = await transaction.videoSubmission.findUnique({ where: { uploadPublicId: publicId } });
      if (existing) {
        if (existing.userId !== parsedUserId.data) return err("NOT_FOUND", "Upload intent not found.");
        if (existing.status === "UPLOADING" && existing.uploadExpiresAt && existing.uploadExpiresAt > now) {
          // Idempotent resume of existing intent
          return ok({
            submissionId: existing.id,
            uploadPublicId: existing.uploadPublicId as string,
            uploadExpiresAt: existing.uploadExpiresAt.toISOString(),
            signature: uploadSignature(parsedUserId.data, assetId),
          });
        }
        return err("CONFLICT", "This upload intent can no longer be resumed. Start a new upload.");
      }

      // Check for any unexpired UPLOADING submission for the same user
      const activeUpload = await transaction.videoSubmission.findFirst({
        where: {
          userId: parsedUserId.data,
          status: "UPLOADING",
          uploadExpiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeUpload) {
        if (parsed.data.resume) {
          const activeAssetId = activeUpload.uploadPublicId?.split("/").pop() ?? assetId;
          return ok({
            submissionId: activeUpload.id,
            uploadPublicId: activeUpload.uploadPublicId as string,
            uploadExpiresAt: activeUpload.uploadExpiresAt?.toISOString() ?? expiresAt.toISOString(),
            signature: uploadSignature(parsedUserId.data, activeAssetId),
          });
        }
        return err("UPLOAD_IN_PROGRESS", "You already have an upload in progress. Resume or cancel it.", {
          submissionId: activeUpload.id,
        });
      }

      const pendingCount = await transaction.videoSubmission.count({
        where: {
          userId: parsedUserId.data,
          OR: [
            { status: "PENDING" },
            { status: "UPLOADING", uploadExpiresAt: { gt: now } },
          ],
        },
      });
      if (pendingCount >= VIDEO_PENDING_SUBMISSION_LIMIT) {
        return err("PENDING_CAP_REACHED", `You have reached the maximum of ${VIDEO_PENDING_SUBMISSION_LIMIT} pending video submissions. Please wait for them to be reviewed.`, { retryAfter: 3600 });
      }

      // Daily limit: 3 submissions in rolling 24 hours. Withdrawn submissions still count.
      const rollingDayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dailySubmissions = await transaction.videoSubmission.findMany({
        where: {
          userId: parsedUserId.data,
          createdAt: { gte: rollingDayStart },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const oldest = dailySubmissions[0]?.createdAt;
      if (dailySubmissions.length >= VIDEO_DAILY_SUBMISSION_LIMIT && oldest) {
        const resetAt = new Date(oldest.getTime() + 24 * 60 * 60 * 1000);
        const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
        const timeFormatted = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(resetAt);

        return err(
          "DAILY_LIMIT_EXCEEDED",
          `You have reached today's upload limit; you can upload again after ${timeFormatted} IST.`,
          { retryAfter },
        );
      }

      // Period limit from active reward rule
      if (activeRule.maxSubmissionsPerPeriod !== null && activeRule.maxSubmissionsPerPeriod !== undefined && activeRule.periodDays) {
        const periodStart = new Date(now.getTime() - activeRule.periodDays * 24 * 60 * 60 * 1000);
        const periodSubmissions = await transaction.videoSubmission.findMany({
          where: {
            userId: parsedUserId.data,
            createdAt: { gte: periodStart },
          },
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        });

        const oldestInPeriod = periodSubmissions[0]?.createdAt;
        if (periodSubmissions.length >= activeRule.maxSubmissionsPerPeriod && oldestInPeriod) {
          const periodResetAt = new Date(oldestInPeriod.getTime() + activeRule.periodDays * 24 * 60 * 60 * 1000);
          const retryAfter = Math.max(1, Math.ceil((periodResetAt.getTime() - now.getTime()) / 1000));
          return err(
            "PERIOD_LIMIT_EXCEEDED",
            `The current reward period allows ${activeRule.maxSubmissionsPerPeriod} video submissions.`,
            { retryAfter },
          );
        }
      }

      const signature = uploadSignature(parsedUserId.data, assetId);
      const intent = await transaction.videoSubmission.create({
        data: {
          userId: parsedUserId.data,
          uploadPublicId: publicId,
          uploadExpiresAt: expiresAt,
          title: parsed.data.title,
          description: parsed.data.description,
          visitDate: new Date(`${parsed.data.visitDate}T00:00:00.000Z`),
          consentOwnership: parsed.data.consentOwnership,
          consentPublish: parsed.data.consentPublish,
          status: "UPLOADING",
          rewardRuleId: activeRule.id,
        },
        select: { id: true, uploadPublicId: true, uploadExpiresAt: true },
      });

      return ok({
        submissionId: intent.id,
        uploadPublicId: intent.uploadPublicId as string,
        uploadExpiresAt: intent.uploadExpiresAt?.toISOString() ?? expiresAt.toISOString(),
        signature,
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.videoSubmission.findUnique({ where: { uploadPublicId: publicId } });
      if (existing && existing.userId === parsedUserId.data && existing.status === "UPLOADING" && existing.uploadExpiresAt && existing.uploadExpiresAt > now) {
        return ok({
          submissionId: existing.id,
          uploadPublicId: existing.uploadPublicId as string,
          uploadExpiresAt: existing.uploadExpiresAt.toISOString(),
          signature: uploadSignature(parsedUserId.data, assetId),
        });
      }
    }
    const errorCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "INTERNAL_ERROR";
    console.error(`[startUpload error code] ${errorCode}`);
    return err("SERVICE_UNAVAILABLE", "Upload service is temporarily unavailable. Please try again shortly.");
  }
}

export async function completeUpload(userId: string, rawInput: unknown): Promise<Result<{ submissionId: string; mediaId: string; duplicateOfId: string | null }>> {
  const parsedUserId = userIdSchema.safeParse(userId);
  const parsed = completeUploadSchema.safeParse(rawInput);
  if (!parsedUserId.success || !parsed.success) return err("VALIDATION", "Invalid upload completion request.");

  let intent: UploadIntent | null = null;
  try {
    intent = await db.$transaction(async (transaction) => {
      const eligibility = await checkAccountEligibility(transaction, parsedUserId.data);
      if (!eligibility.ok) return null;
      const locks = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "VideoSubmission" WHERE "id" = ${parsed.data.submissionId} AND "userId" = ${parsedUserId.data} FOR UPDATE
      `);
      if (!locks[0]) return null;
      const row = await transaction.videoSubmission.findUnique({ where: { id: parsed.data.submissionId }, select: { id: true, userId: true, uploadPublicId: true, uploadExpiresAt: true, status: true } });
      if (!row || row.status !== "UPLOADING" || !row.uploadPublicId || !row.uploadExpiresAt) return null;
      return row as UploadIntent;
    });
  } catch {
    return err("CONFLICT", "Unable to verify this upload intent.");
  }

  if (!intent) return err("NOT_FOUND", "Upload intent not found or expired.");
  if (intent.uploadExpiresAt <= new Date()) {
    await removeCloudinaryAsset(intent.uploadPublicId);
    await db.videoSubmission.updateMany({
      where: { id: intent.id, userId: parsedUserId.data, status: "UPLOADING" },
      data: { status: "REMOVED", rejectionReason: "Upload intent expired." },
    });
    return err("NOT_FOUND", "Upload intent expired. Please start a new upload.");
  }

  let verification: Awaited<ReturnType<typeof verifyCloudinaryAsset>>;
  try {
    verification = await verifyCloudinaryAsset({ purpose: "customer_video", userId: parsedUserId.data, publicId: intent.uploadPublicId });
  } catch {
    verification = { valid: false, reason: "Cloudinary verification is unavailable." };
  }

  if (!verification.valid) {
    await removeCloudinaryAsset(intent.uploadPublicId);
    await db.videoSubmission.updateMany({
      where: { id: intent.id, userId: parsedUserId.data, status: "UPLOADING" },
      data: { status: "REMOVED", rejectionReason: `Upload verification failed: ${verification.reason}` },
    });
    return err("VALIDATION", "The uploaded video could not be verified. It was removed; please try again.");
  }

  try {
    return await db.$transaction(async (transaction) => {
      const locks = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "VideoSubmission" WHERE "id" = ${intent?.id} AND "userId" = ${parsedUserId.data} FOR UPDATE
      `);
      if (!locks[0]) return err("NOT_FOUND", "Upload intent not found.");
      const current = await transaction.videoSubmission.findUnique({ where: { id: intent?.id } });
      if (!current || current.status !== "UPLOADING" || current.mediaId || !current.uploadPublicId || current.uploadPublicId !== intent?.uploadPublicId || !current.uploadExpiresAt || current.uploadExpiresAt <= new Date()) {
        return err("CONFLICT", "This upload has already been completed or expired.");
      }

      const duplicate = verification.asset.contentHash
        ? await transaction.videoSubmission.findFirst({ where: { id: { not: current.id }, contentHash: verification.asset.contentHash }, select: { id: true }, orderBy: { createdAt: "asc" } })
        : null;
      const media = await transaction.media.upsert({
        where: { publicId: verification.asset.publicId },
        create: {
          kind: "VIDEO",
          origin: "CUSTOMER",
          publicId: verification.asset.publicId,
          resourceType: verification.asset.resourceType,
          deliveryType: "authenticated",
          format: verification.asset.format,
          bytes: verification.asset.bytes,
          width: verification.asset.width,
          height: verification.asset.height,
          durationSec: verification.asset.durationSec,
          contentHash: verification.asset.contentHash,
          uploadedById: parsedUserId.data,
          isPublic: false,
          tags: [],
        },
        update: {
          kind: "VIDEO",
          origin: "CUSTOMER",
          resourceType: verification.asset.resourceType,
          deliveryType: "authenticated",
          format: verification.asset.format,
          bytes: verification.asset.bytes,
          width: verification.asset.width,
          height: verification.asset.height,
          durationSec: verification.asset.durationSec,
          contentHash: verification.asset.contentHash,
          uploadedById: parsedUserId.data,
          isPublic: false,
          deletedAt: null,
        },
        select: { id: true },
      });
      await transaction.videoSubmission.update({
        where: { id: current.id },
        data: {
          mediaId: media.id,
          status: "PENDING",
          contentHash: verification.asset.contentHash ?? null,
          duplicateOfId: duplicate?.id ?? null,
          submittedAt: new Date(),
        },
      });
      return ok({ submissionId: current.id, mediaId: media.id, duplicateOfId: duplicate?.id ?? null });
    }, { isolationLevel: "Serializable" });
  } catch {
    return err("CONFLICT", "Unable to save this video submission. Please retry.");
  }
}

export async function withdrawSubmission(userId: string, rawInput: unknown): Promise<Result<{ submissionId: string }>> {
  const parsedUserId = userIdSchema.safeParse(userId);
  const parsed = withdrawSubmissionSchema.safeParse(rawInput);
  if (!parsedUserId.success || !parsed.success) return err("VALIDATION", "Invalid video submission.");

  try {
    const removed = await db.$transaction(async (transaction) => {
      const eligibility = await checkAccountEligibility(transaction, parsedUserId.data);
      if (!eligibility.ok) return null;
      const locks = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "VideoSubmission" WHERE "id" = ${parsed.data.submissionId} AND "userId" = ${parsedUserId.data} FOR UPDATE
      `);
      if (!locks[0]) return null;
      const submission = await transaction.videoSubmission.findUnique({
        where: { id: parsed.data.submissionId },
        select: { id: true, mediaId: true, uploadPublicId: true, status: true },
      });
      if (!submission || (submission.status !== "PENDING" && submission.status !== "UPLOADING")) return null;
      await transaction.videoSubmission.update({
        where: { id: submission.id },
        data: { status: "REMOVED", rejectionReason: "Withdrawn by customer." },
      });
      if (submission.mediaId) {
        await transaction.media.update({ where: { id: submission.mediaId }, data: { isPublic: false, deletedAt: new Date() } });
      }
      return submission;
    }, { isolationLevel: "Serializable" });
    if (!removed) return err("NOT_FOUND", "Video submission not found or cannot be cancelled.");
    if (removed.uploadPublicId) await removeCloudinaryAsset(removed.uploadPublicId);
    return ok({ submissionId: removed.id });
  } catch (error) {
    const errorCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "INTERNAL_ERROR";
    console.error(`[withdrawSubmission error code] ${errorCode}`);
    return err("CONFLICT", "Unable to withdraw this submission.");
  }
}
