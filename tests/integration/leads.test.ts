// @vitest-environment node

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";
import { leadFormSchema } from "../../src/lib/schemas/leads";

loadEnv({ path: ".env.local" });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

integrationDescribe("lead service persistence", () => {
  let testDb: PrismaClient;
  let upsertLead: typeof import("../../src/server/services/leads").upsertLead;
  let limit: typeof import("../../src/server/integrations/ratelimit").limit;

  beforeAll(async () => {
    testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl as string }) });
    await testDb.$connect();
    vi.doMock("@/server/db", () => ({ db: testDb }));
    ({ upsertLead } = await import("../../src/server/services/leads"));
    ({ limit } = await import("../../src/server/integrations/ratelimit"));
  });

  afterAll(async () => { await testDb?.$disconnect(); });

  it("deduplicates phone formats and makes a repeated submission idempotent", async () => {
    const submissionId = crypto.randomUUID();
    const form = (phone: string, id: string) => leadFormSchema.parse({
      formType: "QUICK", submissionId: id, name: "Lead Integration", phone, consentToContact: true,
      startedAt: Date.now() - 4_000, pagePath: "/contact",
    });
    const attribution = { lastTouch: { landingPath: "/contact" } };
    const first = await upsertLead(form("+91 98765 43210", submissionId), { attribution });
    const duplicateSubmit = await upsertLead(form("98765 43210", submissionId), { attribution });
    const secondEnquiry = await upsertLead(form("98765-43210", crypto.randomUUID()), { attribution });
    expect(duplicateSubmit.duplicate).toBe(true);
    expect(duplicateSubmit.id).toBe(first.id);
    expect(secondEnquiry.leadId).toBe(first.leadId);
    expect(await testDb.enquiry.count({ where: { leadId: first.leadId } })).toBe(2);
  });

  it("enforces the shared PostgreSQL limiter atomically", async () => {
    const key = `lead-test:${crypto.randomUUID()}`;
    expect((await limit(key, 2, 3_600)).allowed).toBe(true);
    expect((await limit(key, 2, 3_600)).allowed).toBe(true);
    const blocked = await limit(key, 2, 3_600);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    await testDb.rateLimitBucket.deleteMany({ where: { key } });
  });
});
