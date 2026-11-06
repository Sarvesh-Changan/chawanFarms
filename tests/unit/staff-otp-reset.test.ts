import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  accountFindFirst: vi.fn(),
  accountUpdate: vi.fn(),
  accountCreate: vi.fn(),
  verificationFindFirst: vi.fn(),
  verificationCreate: vi.fn(),
  verificationUpdate: vi.fn(),
  verificationDelete: vi.fn(),
  verificationDeleteMany: vi.fn(),
  sessionDeleteMany: vi.fn(),
  sendEmailMessage: vi.fn(),
  limit: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    account: { findFirst: mocks.accountFindFirst, update: mocks.accountUpdate, create: mocks.accountCreate },
    verification: {
      findFirst: mocks.verificationFindFirst,
      create: mocks.verificationCreate,
      update: mocks.verificationUpdate,
      delete: mocks.verificationDelete,
      deleteMany: mocks.verificationDeleteMany,
    },
    session: { deleteMany: mocks.sessionDeleteMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/server/integrations/email", () => ({
  sendEmailMessage: mocks.sendEmailMessage,
}));

vi.mock("@/server/integrations/ratelimit", () => ({
  limit: mocks.limit,
}));

vi.mock("@/server/services/audit", () => ({
  audit: mocks.audit,
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("scrypt-mocked-hash:salt"),
}));

import {
  completeStaffPasswordReset,
  NEUTRAL_RESET_MESSAGE,
  requestStaffPasswordReset,
  verifyStaffResetOtp,
} from "@/server/auth/staff-password-reset";

const staffUserId = "staff-user-123";
const staffEmail = "admin@chawanfarms.com";
const clientIp = "192.0.2.1";

describe("Staff Email OTP Password Reset Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 3600 });
    mocks.sendEmailMessage.mockResolvedValue({ ok: true, messageId: "msg-123" });
    mocks.audit.mockResolvedValue({ ok: true, data: { id: "audit-123" } });
    mocks.verificationCreate.mockResolvedValue({});
    mocks.verificationUpdate.mockResolvedValue({});
    mocks.verificationDelete.mockResolvedValue({});
    mocks.verificationDeleteMany.mockResolvedValue({ count: 1 });
    mocks.userUpdate.mockResolvedValue({});
    mocks.accountUpdate.mockResolvedValue({});
    mocks.accountCreate.mockResolvedValue({});
    mocks.sessionDeleteMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        account: {
          findFirst: mocks.accountFindFirst,
          update: mocks.accountUpdate,
          create: mocks.accountCreate,
        },
        user: { update: mocks.userUpdate },
        session: { deleteMany: mocks.sessionDeleteMany },
      });
    });
  });

  describe("requestStaffPasswordReset (Initiation & Anti-Enumeration)", () => {
    it("returns neutral message for unknown email without sending email or creating verification record", async () => {
      mocks.userFindUnique.mockResolvedValue(null);

      const result = await requestStaffPasswordReset("unknown@example.com", clientIp);

      expect(result.ok).toBe(true);
      expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
      expect(mocks.sendEmailMessage).not.toHaveBeenCalled();
      expect(mocks.verificationCreate).not.toHaveBeenCalled();
    });

    it("returns neutral message for customer account without sending OTP", async () => {
      mocks.userFindUnique.mockResolvedValue({
        id: "cust-1",
        email: "customer@example.com",
        type: "CUSTOMER",
        status: "ACTIVE",
        deletedAt: null,
      });

      const result = await requestStaffPasswordReset("customer@example.com", clientIp);

      expect(result.ok).toBe(true);
      expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
      expect(mocks.sendEmailMessage).not.toHaveBeenCalled();
      expect(mocks.verificationCreate).not.toHaveBeenCalled();
    });

    it("creates OTP record and sends transactional email for active staff user", async () => {
      mocks.userFindUnique.mockResolvedValue({
        id: staffUserId,
        email: staffEmail,
        type: "STAFF",
        status: "ACTIVE",
        deletedAt: null,
      });
      mocks.verificationFindFirst.mockResolvedValue(null);

      const result = await requestStaffPasswordReset(staffEmail, clientIp);

      expect(result.ok).toBe(true);
      expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
      expect(mocks.verificationCreate).toHaveBeenCalledTimes(1);
      expect(mocks.sendEmailMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "staff-password-reset-otp",
          to: staffEmail,
          transactional: true,
        }),
      );

      // Verify email text complies with CDS rules (short, states 10 min expiry, ignore if unrequested, no "successfully")
      const sentMessage = mocks.sendEmailMessage.mock.calls[0]?.[0];
      expect(sentMessage.text).toContain("10 minutes");
      expect(sentMessage.text).toContain("If you did not request this, ignore this email");
      expect(sentMessage.text.toLowerCase()).not.toContain("successfully");
    });

    it("enforces 60-second cooldown on repeated requests", async () => {
      mocks.userFindUnique.mockResolvedValue({
        id: staffUserId,
        email: staffEmail,
        type: "STAFF",
        status: "ACTIVE",
        deletedAt: null,
      });
      // Existing OTP created 20 seconds ago
      mocks.verificationFindFirst.mockResolvedValue({
        id: "otp-old",
        createdAt: new Date(Date.now() - 20 * 1000),
      });

      const result = await requestStaffPasswordReset(staffEmail, clientIp);

      expect(result.ok).toBe(false);
      expect(result.message).toContain("seconds before requesting a new code");
      expect(mocks.sendEmailMessage).not.toHaveBeenCalled();
    });

    it("invalidates existing codes when a new code is issued after cooldown", async () => {
      mocks.userFindUnique.mockResolvedValue({
        id: staffUserId,
        email: staffEmail,
        type: "STAFF",
        status: "ACTIVE",
        deletedAt: null,
      });
      // Existing OTP created 70 seconds ago (> 60s cooldown)
      mocks.verificationFindFirst.mockResolvedValue({
        id: "otp-old",
        createdAt: new Date(Date.now() - 70 * 1000),
      });

      const result = await requestStaffPasswordReset(staffEmail, clientIp);

      expect(result.ok).toBe(true);
      expect(mocks.verificationDeleteMany).toHaveBeenCalled();
      expect(mocks.verificationCreate).toHaveBeenCalledTimes(1);
    });

    it("enforces rate limits of at most 5 requests per hour", async () => {
      mocks.limit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 1800 });

      const result = await requestStaffPasswordReset(staffEmail, clientIp);

      expect(result.ok).toBe(false);
      expect(result.message).toContain("Too many reset attempts");
      expect(mocks.sendEmailMessage).not.toHaveBeenCalled();
    });
  });

  describe("verifyStaffResetOtp (Code Verification & Grant Issuance)", () => {
    it("rejects non-existent or expired verification record", async () => {
      mocks.verificationFindFirst.mockResolvedValue(null);

      const result = await verifyStaffResetOtp(staffEmail, "123456", clientIp);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("Invalid or expired verification code");
      }
    });

    it("increments attempt count on incorrect code and deletes record on 5th failure", async () => {
      const storedPayload = {
        hmac: "stored-hmac-mismatch",
        attempts: 4,
        userId: staffUserId,
        createdAt: Date.now(),
      };
      mocks.verificationFindFirst.mockResolvedValue({
        id: "otp-rec-1",
        value: JSON.stringify(storedPayload),
        expiresAt: new Date(Date.now() + 500_000),
      });

      const result = await verifyStaffResetOtp(staffEmail, "123456", clientIp);

      expect(result.ok).toBe(false);
      // 5th failed attempt should delete the record to invalidate
      expect(mocks.verificationDelete).toHaveBeenCalledWith({ where: { id: "otp-rec-1" } });
      if (!result.ok) {
        expect(result.error.message).toContain("Too many incorrect attempts");
      }
    });

    it("issues a single-use 15-minute grant token on correct code and deletes the OTP", async () => {
      const { createHmac } = await import("node:crypto");
      const { env } = await import("@/config/env");
      const validCode = "654321";
      const validHmac = createHmac("sha256", env.AUTH_SECRET).update(validCode).digest("hex");

      const storedPayload = {
        hmac: validHmac,
        attempts: 0,
        userId: staffUserId,
        createdAt: Date.now(),
      };
      mocks.verificationFindFirst.mockResolvedValue({
        id: "otp-rec-2",
        value: JSON.stringify(storedPayload),
        expiresAt: new Date(Date.now() + 500_000),
      });

      const result = await verifyStaffResetOtp(staffEmail, validCode, clientIp);

      expect(result.ok).toBe(true);
      // Deletes OTP record immediately upon match
      expect(mocks.verificationDelete).toHaveBeenCalledWith({ where: { id: "otp-rec-2" } });
      // Creates single-use grant record
      expect(mocks.verificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identifier: expect.stringContaining("staff-reset-grant:"),
          }),
        }),
      );
      if (result.ok) {
        expect(typeof result.data.grantToken).toBe("string");
        expect(result.data.grantToken.length).toBeGreaterThanOrEqual(32);
      }
    });
  });

  describe("completeStaffPasswordReset (Password Update & Session Revocation)", () => {
    it("rejects expired or reused grant token", async () => {
      mocks.verificationFindFirst.mockResolvedValue(null);

      const result = await completeStaffPasswordReset("invalid-grant", "ValidPassword123!", clientIp);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("expired");
      }
    });

    it("enforces password policy on the new password", async () => {
      const grantPayload = { userId: staffUserId, email: staffEmail, createdAt: Date.now() };
      mocks.verificationFindFirst.mockResolvedValue({
        id: "grant-rec-1",
        value: JSON.stringify(grantPayload),
        expiresAt: new Date(Date.now() + 500_000),
      });

      // Short password (< 12 chars)
      const result = await completeStaffPasswordReset("valid-grant", "Short1!", clientIp);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("at least 12 characters");
      }
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("updates password, revokes all sessions, sends confirmation email, and writes audit entry", async () => {
      const grantPayload = { userId: staffUserId, email: staffEmail, createdAt: Date.now() };
      mocks.verificationFindFirst.mockResolvedValue({
        id: "grant-rec-2",
        value: JSON.stringify(grantPayload),
        expiresAt: new Date(Date.now() + 500_000),
      });
      mocks.accountFindFirst.mockResolvedValue({ id: "acc-1" });

      const strongPassword = "Correct-Horse-Battery-Staple-2026!";
      const result = await completeStaffPasswordReset("valid-grant", strongPassword, clientIp);

      expect(result.ok).toBe(true);
      // Single-use: grant record deleted immediately
      expect(mocks.verificationDelete).toHaveBeenCalledWith({ where: { id: "grant-rec-2" } });

      // Transaction updates account and resets failed login count
      expect(mocks.transaction).toHaveBeenCalled();
      expect(mocks.accountUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { password: "scrypt-mocked-hash:salt" },
        }),
      );
      expect(mocks.userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: staffUserId },
          data: { failedLoginCount: 0, lockedUntil: null },
        }),
      );

      // Revokes ALL sessions for this user
      expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
        where: { userId: staffUserId },
      });

      // Writes audit entry
      expect(mocks.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "auth.staff_password_reset",
          entityType: "User",
          entityId: staffUserId,
        }),
      );

      // Sends confirmation email
      expect(mocks.sendEmailMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "staff-password-reset-complete",
          to: staffEmail,
          transactional: true,
        }),
      );
    });
  });
});
