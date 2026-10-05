// @vitest-environment node

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

loadEnv({ path: ".env.local" });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

integrationDescribe("database integrity", () => {
  let testDb: PrismaClient | undefined;

  function database(): PrismaClient {
    if (!testDb) {
      throw new Error("TEST_DATABASE_URL is required for database integration tests");
    }

    return testDb;
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) return;

    testDb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });
    await testDb.$connect();
    await testDb.$executeRaw`
      TRUNCATE TABLE "PointsLedger", "AuditLog", "VideoSubmission", "Media",
        "AvailabilityDay", "Accommodation", "user" CASCADE
    `;
  });

  afterAll(async () => {
    if (!testDb) return;

    await testDb.$disconnect();
  });

  it("rejects UPDATE and DELETE on PointsLedger and AuditLog", async () => {
    const db = database();
    const user = await db.user.create({
      data: { email: "integrity@example.com", name: "Integrity Test" },
    });
    const ledger = await db.pointsLedger.create({
      data: {
        userId: user.id,
        type: "EARN",
        points: 10,
        balanceAfter: 10,
        idempotencyKey: `integrity-ledger-${crypto.randomUUID()}`,
      },
    });
    const audit = await db.auditLog.create({
      data: { action: "integrity.test" },
    });

    await expect(
      db.pointsLedger.update({
        where: { id: ledger.id },
        data: { reason: "must fail" },
      }),
    ).rejects.toThrow(/append-only table/);
    await expect(
      db.pointsLedger.delete({ where: { id: ledger.id } }),
    ).rejects.toThrow(/append-only table/);
    await expect(
      db.auditLog.update({
        where: { id: audit.id },
        data: { action: "must fail" },
      }),
    ).rejects.toThrow(/append-only table/);
    await expect(db.auditLog.delete({ where: { id: audit.id } })).rejects.toThrow(
      /append-only table/,
    );
  });

  it("rejects a second EARN row for one video submission", async () => {
    const db = database();
    const user = await db.user.create({
      data: { email: "video-integrity@example.com", name: "Video Integrity Test" },
    });
    const media = await db.media.create({
      data: {
        kind: "VIDEO",
        publicId: `integrity-${crypto.randomUUID()}`,
        resourceType: "video",
        tags: [],
      },
    });
    const video = await db.videoSubmission.create({
      data: {
        userId: user.id,
        mediaId: media.id,
        consentOwnership: true,
      },
    });

    await db.pointsLedger.create({
      data: {
        userId: user.id,
        type: "EARN",
        points: 20,
        balanceAfter: 20,
        idempotencyKey: `video-earn-1-${crypto.randomUUID()}`,
        videoSubmissionId: video.id,
      },
    });

    await expect(
      db.pointsLedger.create({
        data: {
          userId: user.id,
          type: "EARN",
          points: 20,
          balanceAfter: 40,
          idempotencyKey: `video-earn-2-${crypto.randomUUID()}`,
          videoSubmissionId: video.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate ledger idempotency keys", async () => {
    const db = database();
    const user = await db.user.create({
      data: { email: "idempotency@example.com", name: "Idempotency Test" },
    });
    const idempotencyKey = `duplicate-${crypto.randomUUID()}`;

    await db.pointsLedger.create({
      data: {
        userId: user.id,
        type: "EARN",
        points: 5,
        balanceAfter: 5,
        idempotencyKey,
      },
    });

    await expect(
      db.pointsLedger.create({
        data: {
          userId: user.id,
          type: "EARN",
          points: 5,
          balanceAfter: 10,
          idempotencyKey,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate accommodation availability dates", async () => {
    const db = database();
    const accommodation = await db.accommodation.create({
      data: {
        slug: `integrity-${crypto.randomUUID()}`,
        type: "TENT",
        name: { en: "Integrity Test Tent" },
      },
    });
    const date = new Date("2026-01-15T00:00:00.000Z");

    await db.availabilityDay.create({
      data: { accommodationId: accommodation.id, date, capacity: 2 },
    });

    await expect(
      db.availabilityDay.create({
        data: { accommodationId: accommodation.id, date, capacity: 2 },
      }),
    ).rejects.toThrow();
  });
});
