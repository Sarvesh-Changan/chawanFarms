// @vitest-environment node

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

vi.mock("@/server/integrations/ratelimit", () => ({
  limit: vi.fn(async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 3_600 })),
}));

vi.mock("@/server/integrations/cloudinary", () => ({
  createUploadSignature: vi.fn(({ assetId }: { assetId: string }) => ({
    signedParams: { public_id: assetId, folder: "customers/test/videos" },
    uploadEndpoint: "https://upload.example.test",
  })),
  verifyCloudinaryAsset: vi.fn(async ({ publicId, userId }: { publicId: string; userId: string }) => ({
    valid: true as const,
    asset: {
      publicId,
      kind: "VIDEO" as const,
      origin: "CUSTOMER" as const,
      resourceType: "video" as const,
      deliveryType: "authenticated",
      format: "mp4",
      bytes: 1_000,
      durationSec: 12,
      contentHash: "same-video-hash",
      uploadedById: userId,
    },
  })),
  deleteCloudinaryAsset: vi.fn(async () => true),
}));

integrationDescribe("customer video submission reward isolation", () => {
  let testDb: PrismaClient;
  let startUpload: typeof import("../../src/server/services/videoSubmissions").startUpload;
  let completeUpload: typeof import("../../src/server/services/videoSubmissions").completeUpload;
  let withdrawSubmission: typeof import("../../src/server/services/videoSubmissions").withdrawSubmission;
  const userId = crypto.randomUUID();

  beforeAll(async () => {
    testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl as string }) });
    await testDb.$connect();
    await testDb.user.create({
      data: {
        id: userId,
        email: `video-isolation-${userId}@example.com`,
        emailVerified: true,
        name: "Video Isolation Test",
        profile: { create: { referralCode: `VID${userId.replaceAll("-", "").slice(0, 12)}` } },
      },
    });
    vi.doMock("@/server/db", () => ({ db: testDb }));
    ({ startUpload, completeUpload, withdrawSubmission } = await import("../../src/server/services/videoSubmissions"));
  });

  afterAll(async () => {
    await testDb?.videoSubmission.deleteMany({ where: { userId } }).catch(() => undefined);
    await testDb?.media.deleteMany({ where: { uploadedById: userId } }).catch(() => undefined);
    await testDb?.user.delete({ where: { id: userId } }).catch(() => undefined);
    await testDb?.$disconnect();
  });

  it("keeps ledger rows and cached balances unchanged across start, complete, and withdraw", async () => {
    const visitDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const beforeProfile = await testDb.customerProfile.findUniqueOrThrow({ where: { userId } });
    const beforeLedgerCount = await testDb.pointsLedger.count({ where: { userId } });

    const started = await startUpload(userId, {
      idempotencyKey: `video-test-${crypto.randomUUID()}`,
      visitDate,
      consentOwnership: true,
      consentPublish: false,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const completed = await completeUpload(userId, { submissionId: started.data.submissionId });
    expect(completed.ok).toBe(true);
    const withdrawn = await withdrawSubmission(userId, { submissionId: started.data.submissionId });
    expect(withdrawn.ok).toBe(true);

    const afterProfile = await testDb.customerProfile.findUniqueOrThrow({ where: { userId } });
    expect(await testDb.pointsLedger.count({ where: { userId } })).toBe(beforeLedgerCount);
    expect(afterProfile.pointsBalance).toBe(beforeProfile.pointsBalance);
    expect(afterProfile.lifetimePointsEarned).toBe(beforeProfile.lifetimePointsEarned);
    expect(await testDb.videoSubmission.findUniqueOrThrow({ where: { id: started.data.submissionId } })).toMatchObject({ status: "REMOVED", consentPublish: false });
  });
});
