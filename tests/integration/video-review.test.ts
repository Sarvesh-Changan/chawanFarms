// @vitest-environment node

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

vi.mock("@/server/integrations/cloudinary", () => ({
  deleteCloudinaryAsset: vi.fn(async () => true),
  copyAuthenticatedVideoToPublic: vi.fn(async ({ targetPublicId }: { targetPublicId: string }) => ({ publicId: targetPublicId, bytes: 1_000, durationSec: 10, format: "mp4" })),
  createAuthenticatedVideoPreviewUrl: vi.fn(() => "https://preview.example.test/signed"),
}));

integrationDescribe("video review workflow", () => {
  let testDb1: PrismaClient;
  let testDb2: PrismaClient;
  let approveVideo: typeof import("../../src/server/services/videoReview").approveVideo;
  let rejectVideo: typeof import("../../src/server/services/videoReview").rejectVideo;
  const customerId = crypto.randomUUID();
  const reviewerId = crypto.randomUUID();
  const reviewerTwoId = crypto.randomUUID();
  const ruleId = crypto.randomUUID();
  const createdSubmissionIds: string[] = [];

  beforeAll(async () => {
    testDb1 = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl as string }) });
    testDb2 = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl as string }) });
    await Promise.all([testDb1.$connect(), testDb2.$connect()]);
    await testDb1.user.createMany({ data: [
      { id: customerId, email: `review-customer-${customerId}@example.com`, emailVerified: true, name: "Review Customer" },
      { id: reviewerId, email: `reviewer-${reviewerId}@example.com`, emailVerified: true, name: "Reviewer", type: "STAFF" },
      { id: reviewerTwoId, email: `reviewer-two-${reviewerTwoId}@example.com`, emailVerified: true, name: "Reviewer Two", type: "STAFF" },
    ] });
    await testDb1.customerProfile.create({ data: { userId: customerId, referralCode: `REV${customerId.replaceAll("-", "").slice(0, 10)}` } });
    await testDb1.rewardRule.create({ data: { id: ruleId, version: Number(`${Date.now()}`.slice(-8)), isActive: true, pointsPerApprovedVideo: 10, minPointsToRedeem: 10, couponValidityDays: 30 } });
    vi.doMock("@/server/db", () => ({ db: testDb1 }));
    ({ approveVideo, rejectVideo } = await import("../../src/server/services/videoReview"));
  });

  afterAll(async () => {
    await testDb1?.pointsLedger.deleteMany({ where: { userId: customerId } }).catch(() => undefined);
    await testDb1?.notificationOutbox.deleteMany({ where: { to: { contains: `review-customer-${customerId}` } } }).catch(() => undefined);
    await testDb1?.notification.deleteMany({ where: { userId: customerId } }).catch(() => undefined);
    await testDb1?.auditLog.deleteMany({ where: { entityId: { in: createdSubmissionIds } } }).catch(() => undefined);
    await testDb1?.videoSubmission.deleteMany({ where: { id: { in: createdSubmissionIds } } }).catch(() => undefined);
    await testDb1?.media.deleteMany({ where: { uploadedById: customerId } }).catch(() => undefined);
    await testDb1?.rewardRule.delete({ where: { id: ruleId } }).catch(() => undefined);
    await testDb1?.user.deleteMany({ where: { id: { in: [customerId, reviewerId, reviewerTwoId] } } }).catch(() => undefined);
    await Promise.all([testDb1?.$disconnect(), testDb2?.$disconnect()]);
  });

  async function pending(hash = crypto.randomUUID()) {
    const media = await testDb1.media.create({ data: { kind: "VIDEO", origin: "CUSTOMER", publicId: `customers/${customerId}/videos/${crypto.randomUUID()}`, resourceType: "video", deliveryType: "authenticated", format: "mp4", bytes: 1000, durationSec: 10, contentHash: hash, uploadedById: customerId, tags: [] } });
    const submission = await testDb1.videoSubmission.create({ data: { userId: customerId, mediaId: media.id, status: "PENDING", visitDate: new Date("2026-10-19T00:00:00.000Z"), consentOwnership: true, contentHash: hash, submittedAt: new Date() } });
    createdSubmissionIds.push(submission.id);
    return submission;
  }

  it("approve twice creates exactly one EARN row and updates the balance once", async () => {
    const submission = await pending();
    const before = await testDb1.customerProfile.findUniqueOrThrow({ where: { userId: customerId } });
    const input = { submissionId: submission.id, idempotencyKey: `approve-${crypto.randomUUID()}`, duplicateAcknowledged: false, override: false };
    const first = await approveVideo({ id: reviewerId, roleNames: ["Owner/Manager"] }, input, testDb1);
    const second = await approveVideo({ id: reviewerId, roleNames: ["Owner/Manager"] }, input, testDb1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(await testDb1.pointsLedger.count({ where: { videoSubmissionId: submission.id, type: "EARN" } })).toBe(1);
    const after = await testDb1.customerProfile.findUniqueOrThrow({ where: { userId: customerId } });
    expect(after.pointsBalance - before.pointsBalance).toBe(10);
  });

  it("rejects without creating points", async () => {
    const submission = await pending();
    const result = await rejectVideo(reviewerId, { submissionId: submission.id, idempotencyKey: `reject-${crypto.randomUUID()}`, reason: "The video does not show the visit clearly." }, testDb1);
    expect(result.ok).toBe(true);
    expect(await testDb1.pointsLedger.count({ where: { videoSubmissionId: submission.id } })).toBe(0);
  });

  it("blocks self approval and lets only one concurrent reviewer win", async () => {
    const own = await pending();
    const selfApproval = await approveVideo({ id: customerId, roleNames: ["Owner/Manager"] }, { submissionId: own.id, idempotencyKey: `self-${crypto.randomUUID()}` }, testDb1);
    expect(selfApproval.ok).toBe(false);
    if (!selfApproval.ok) expect(selfApproval.error.code).toBe("FORBIDDEN");
    const race = await pending();
    const input = { submissionId: race.id, idempotencyKey: `race-${crypto.randomUUID()}` };
    const [left, right] = await Promise.all([
      approveVideo({ id: reviewerId, roleNames: ["Owner/Manager"] }, input, testDb1),
      approveVideo({ id: reviewerTwoId, roleNames: ["Owner/Manager"] }, input, testDb2),
    ]);
    expect([left.ok, right.ok].filter(Boolean)).toHaveLength(1);
    expect(await testDb1.pointsLedger.count({ where: { videoSubmissionId: race.id, type: "EARN" } })).toBe(1);
  });
});
