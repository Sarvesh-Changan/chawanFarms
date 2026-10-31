// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing service
vi.mock("@/server/integrations/ratelimit", () => ({
  limit: vi.fn(async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 3_600 })),
}));

vi.mock("@/server/integrations/cloudinary", () => ({
  createUploadSignature: vi.fn(({ assetId }: { assetId: string }) => ({
    cloudName: "test-cloud",
    apiKey: "test-key",
    resourceType: "video",
    signature: "test-signature",
    signedParams: { public_id: assetId },
    allowedFormats: ["mp4", "mov", "webm"],
    maxBytes: 100_000_000,
    maxDurationSeconds: 90,
    uploadEndpoint: "https://api.cloudinary.com/v1_1/test-cloud/video/upload",
  })),
  verifyCloudinaryAsset: vi.fn(),
  deleteCloudinaryAsset: vi.fn(async () => true),
}));

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      user: {
        findUnique: vi.fn(),
      },
      customerProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      rewardRule: {
        findFirst: vi.fn(),
      },
      videoSubmission: {
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      pointsLedger: {
        create: vi.fn(),
      },
    },
  };
});

vi.mock("@/server/db", () => ({ db: mockDb }));

import { startUpload } from "../../src/server/services/videoSubmissions";

describe("startUpload service error handling & state candidates", () => {
  const userId = "test-user-12345678901234567890";
  const visitDate = "2026-10-30";
  const validPayload = {
    idempotencyKey: "test-key-1234567890123456",
    visitDate,
    consentOwnership: true,
    consentPublish: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));
    mockDb.$queryRaw.mockResolvedValue([{ id: "profile-id" }]);

    mockDb.user.findUnique.mockResolvedValue({
      id: userId,
      type: "CUSTOMER",
      status: "ACTIVE",
      emailVerified: true,
      deletedAt: null,
    });

    mockDb.customerProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      userId,
      pointsBalance: 100,
      lifetimePointsEarned: 100,
    });

    mockDb.rewardRule.findFirst.mockResolvedValue({
      id: "rule-1",
      version: 1,
      isActive: true,
      maxSubmissionsPerPeriod: 5,
      periodDays: 30,
    });

    mockDb.videoSubmission.updateMany.mockResolvedValue({ count: 0 });
    mockDb.videoSubmission.findUnique.mockResolvedValue(null);
    mockDb.videoSubmission.findFirst.mockResolvedValue(null);
    mockDb.videoSubmission.findMany.mockResolvedValue([]);
    mockDb.videoSubmission.count.mockResolvedValue(0);
    mockDb.videoSubmission.create.mockImplementation(async (args: { data: { uploadPublicId: string; uploadExpiresAt: Date } }) => ({
      id: "sub-123",
      uploadPublicId: args.data.uploadPublicId,
      uploadExpiresAt: args.data.uploadExpiresAt,
    }));
  });

  it("succeeds and returns 200 payload for valid customer with active rule", async () => {
    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.submissionId).toBe("sub-123");
    expect(res.data.signature).toBeDefined();
    // Proves uploading never creates PointsLedger rows
    expect(mockDb.pointsLedger.create).not.toHaveBeenCalled();
  });

  it("candidate state: returns 409 UPLOAD_IN_PROGRESS when an unexpired UPLOADING row exists with a different key", async () => {
    const futureDate = new Date(Date.now() + 1800 * 1000);
    mockDb.videoSubmission.findFirst.mockResolvedValue({
      id: "active-upload-999",
      userId,
      status: "UPLOADING",
      uploadExpiresAt: futureDate,
      uploadPublicId: "customers/test/videos/other-asset",
    });

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("UPLOAD_IN_PROGRESS");
    expect(res.error.message).toBe("You already have an upload in progress. Resume or cancel it.");
    expect(res.error.submissionId).toBe("active-upload-999");
  });

  it("resumes existing unexpired UPLOADING row when resume=true is passed", async () => {
    const futureDate = new Date(Date.now() + 1800 * 1000);
    mockDb.videoSubmission.findFirst.mockResolvedValue({
      id: "active-upload-999",
      userId,
      status: "UPLOADING",
      uploadExpiresAt: futureDate,
      uploadPublicId: "customers/test/videos/other-asset",
    });

    const res = await startUpload(userId, { ...validPayload, resume: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.submissionId).toBe("active-upload-999");
    expect(res.data.uploadPublicId).toBe("customers/test/videos/other-asset");
  });

  it("same idempotency key returns the same submission (idempotent retry)", async () => {
    const futureDate = new Date(Date.now() + 1800 * 1000);
    mockDb.videoSubmission.findUnique.mockResolvedValue({
      id: "existing-sub-456",
      userId,
      status: "UPLOADING",
      uploadExpiresAt: futureDate,
      uploadPublicId: "customers/test/videos/asset-456",
    });

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.submissionId).toBe("existing-sub-456");
  });

  it("lazily expires stale UPLOADING rows (>1 hour) during startUpload", async () => {
    await startUpload(userId, validPayload);
    expect(mockDb.videoSubmission.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        status: "UPLOADING",
        uploadExpiresAt: { lte: expect.any(Date) },
      },
      data: {
        status: "REMOVED",
        rejectionReason: "Upload intent expired.",
      },
    });
  });

  it("candidate state: returns 429 DAILY_LIMIT_EXCEEDED with reset time when rolling 24h cap is reached", async () => {
    const now = Date.now();
    const twentyHoursAgo = new Date(now - 20 * 3600 * 1000);
    mockDb.videoSubmission.findMany.mockImplementation(async (args: { where?: { createdAt?: { gte?: Date } } }) => {
      // 24-hour daily query has createdAt: { gte: ~24h }
      const gteTime = args?.where?.createdAt?.gte?.getTime?.() ?? 0;
      if (gteTime > now - 48 * 3600 * 1000) {
        return [
          { createdAt: twentyHoursAgo },
          { createdAt: new Date(now - 10 * 3600 * 1000) },
          { createdAt: new Date(now - 2 * 3600 * 1000) },
        ];
      }
      return [];
    });

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(res.error.message).toContain("You have reached today's upload limit; you can upload again after");
    expect(res.error.retryAfter).toBeGreaterThan(0);
  });

  it("candidate state: returns 429 PERIOD_LIMIT_EXCEEDED when active rule period cap is reached", async () => {
    const now = Date.now();
    const rollingDayCutoff = now - 24 * 3600 * 1000;

    mockDb.videoSubmission.findMany.mockImplementation(async (args: { where?: { createdAt?: { gte?: Date } } }) => {
      const gte = args?.where?.createdAt?.gte;
      // If the query is for the last 24 hours, return empty array so daily limit is not hit
      if (gte && gte.getTime() > rollingDayCutoff - 1000) {
        return [];
      }
      // If the query is for the period (30 days), return 5 items
      return [
        { createdAt: new Date(now - 5 * 86400 * 1000) },
        { createdAt: new Date(now - 4 * 86400 * 1000) },
        { createdAt: new Date(now - 3 * 86400 * 1000) },
        { createdAt: new Date(now - 2 * 86400 * 1000) },
        { createdAt: new Date(now - 1 * 86400 * 1000) },
      ];
    });

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("PERIOD_LIMIT_EXCEEDED");
    expect(res.error.retryAfter).toBeGreaterThan(0);
  });

  it("candidate state: returns 429 PENDING_CAP_REACHED when pending submission limit (20) is hit", async () => {
    mockDb.videoSubmission.count.mockResolvedValue(20);

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("PENDING_CAP_REACHED");
    expect(res.error.retryAfter).toBe(3600);
  });

  it("candidate state: returns 403 EMAIL_NOT_VERIFIED when user email is unverified", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: userId,
      type: "CUSTOMER",
      status: "ACTIVE",
      emailVerified: false,
      deletedAt: null,
    });

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("EMAIL_NOT_VERIFIED");
    expect(res.error.message).toBe("Please verify your email first.");
  });

  it("candidate state: returns 403 ACCOUNT_INELIGIBLE when user is not active customer", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: userId,
      type: "STAFF",
      status: "ACTIVE",
      emailVerified: true,
      deletedAt: null,
    });

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("ACCOUNT_INELIGIBLE");
  });

  it("candidate state: returns 503 REWARDS_DISABLED when no active reward rule exists", async () => {
    mockDb.rewardRule.findFirst.mockResolvedValue(null);

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("REWARDS_DISABLED");
    expect(res.error.message).toBe("Video reward submissions are currently paused. Please check back later.");
  });

  it("candidate state: returns 422 VALIDATION on future visit date", async () => {
    const res = await startUpload(userId, {
      ...validPayload,
      visitDate: "2099-01-01",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("VALIDATION");
    expect(res.error.message).toContain("Visit date must be a real date and cannot be in the future");
  });

  it("candidate state: returns 503 SERVICE_UNAVAILABLE on database lock conflict / unexpected DB error", async () => {
    mockDb.$transaction.mockRejectedValueOnce(new Error("Lock acquisition failure"));

    const res = await startUpload(userId, validPayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.error.message).toBe("Upload service is temporarily unavailable. Please try again shortly.");
  });
});
