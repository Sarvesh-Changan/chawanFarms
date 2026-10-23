// @vitest-environment node

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

integrationDescribe("customer account IDOR and privacy boundaries", () => {
  let testDb: PrismaClient;
  let account: typeof import("../../src/server/services/account");
  let userA: { id: string };
  let userB: { id: string };
  let bookingB: { id: string };
  let enquiryB: { id: string };

  beforeAll(async () => {
    testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl as string }) });
    await testDb.$connect();
    userA = await testDb.user.create({
      data: {
        email: `account-a-${crypto.randomUUID()}@example.com`, name: "Account A", emailVerified: true,
        profile: { create: { referralCode: `A${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}` } },
      },
    });
    userB = await testDb.user.create({
      data: {
        email: `account-b-${crypto.randomUUID()}@example.com`, name: "Account B", emailVerified: true,
        profile: { create: { referralCode: `B${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}` } },
      },
    });
    const lead = await testDb.lead.create({ data: { email: `account-b-lead-${crypto.randomUUID()}@example.com`, userId: userB.id, name: "Account B", phone: "+919821502956" } });
    const booking = await testDb.booking.create({ data: { reference: `BKG-TEST-${crypto.randomUUID()}`, leadId: lead.id, userId: userB.id, checkIn: new Date("2030-01-01"), checkOut: new Date("2030-01-02"), nights: 1, adults: 2, contactName: "Account B", contactPhone: "+919821502956", subtotalPaise: 100, totalPaise: 100, pricingSnapshot: {} } });
    bookingB = { id: booking.id };
    const enquiry = await testDb.enquiry.create({ data: { reference: `ENQ-TEST-${crypto.randomUUID()}`, leadId: lead.id, message: "Private enquiry" } });
    enquiryB = { id: enquiry.id };
    await testDb.videoSubmission.create({ data: { userId: userB.id, title: "Private video", status: "REJECTED", rejectionReason: "Private reason", consentOwnership: true } });
    await testDb.auditLog.create({ data: { actorId: userB.id, action: "test.private" } });
    vi.doMock("@/server/db", () => ({ db: testDb }));
    account = await import("../../src/server/services/account");
  });

  afterAll(async () => { await testDb?.accountDeletionRequest.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }).catch(() => undefined); await testDb?.videoSubmission.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }).catch(() => undefined); await testDb?.enquiry.deleteMany({ where: { lead: { userId: { in: [userA.id, userB.id] } } } }).catch(() => undefined); await testDb?.booking.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }).catch(() => undefined); await testDb?.lead.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }).catch(() => undefined); await testDb?.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }).catch(() => undefined); await testDb?.$disconnect(); });

  it("returns no detail for another user and excludes their rows from lists", async () => {
    expect(await account.getCustomerBooking(userA.id, bookingB.id)).toBeNull();
    expect(await account.getCustomerEnquiry(userA.id, enquiryB.id)).toBeNull();
    expect((await account.listCustomerBookings(userA.id)).some((row) => row.id === bookingB.id)).toBe(false);
    expect((await account.listCustomerEnquiries(userA.id)).some((row) => row.id === enquiryB.id)).toBe(false);
  });

  it("exports only the session user's customer-visible fields", async () => {
    const exported = await account.getPrivacyExport(userA.id);
    expect(exported).not.toBeNull();
    expect(JSON.stringify(exported)).not.toContain("internalNotes");
    expect(JSON.stringify(exported)).not.toContain("reviewedById");
    expect(JSON.stringify(exported)).not.toContain("duplicateOfId");
    expect(JSON.stringify(exported)).not.toContain("test.private");
    expect(exported?.videos).toEqual([]);
  });

  it("enforces one pending deletion request per user", async () => {
    const first = await testDb.accountDeletionRequest.create({ data: { userId: userA.id } });
    await expect(testDb.accountDeletionRequest.create({ data: { userId: userA.id } })).rejects.toThrow();
    await testDb.accountDeletionRequest.update({ where: { id: first.id }, data: { status: "CANCELLED" } });
    await expect(testDb.accountDeletionRequest.create({ data: { userId: userA.id } })).resolves.toBeTruthy();
  });
});
