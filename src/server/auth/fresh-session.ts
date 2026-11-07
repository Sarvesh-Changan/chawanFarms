import "server-only";

import { createOTP } from "@better-auth/utils/otp";
import { verifyPassword } from "better-auth/crypto";
import { headers } from "next/headers";

import { err, ok, type Result } from "@/lib/result";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";

const FRESH_SESSION_MAX_ATTEMPTS = 5;
const FRESH_SESSION_WINDOW_SECONDS = 900; // 15 minutes
const TOTP_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_TOTP_FAILURES = 5;

export type FreshSessionInput = {
  password: string;
  totpCode?: string;
};

export async function verifyFreshSession(
  actorId: string,
  input: FreshSessionInput,
): Promise<Result<{ verified: true }>> {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("cf-connecting-ip")?.slice(0, 128) ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 128);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 512);
  const requestId = requestHeaders.get("x-request-id")?.slice(0, 128);

  // Rate limit fresh session verification
  const rateKey = `admin:fresh-session:${actorId}`;
  const rate = await limit(rateKey, FRESH_SESSION_MAX_ATTEMPTS, FRESH_SESSION_WINDOW_SECONDS);
  if (!rate.allowed) {
    return err("RATE_LIMITED", "Too many authentication attempts. Please try again later.");
  }

  // Load actor credentials
  const [account, user] = await Promise.all([
    db.account.findFirst({
      where: { userId: actorId, providerId: "credential" },
      select: { password: true },
    }),
    db.user.findUnique({
      where: { id: actorId },
      select: { id: true, twoFactorEnabled: true, status: true, type: true },
    }),
  ]);

  if (!account?.password || !user || user.type !== "STAFF" || user.status !== "ACTIVE") {
    await audit({
      actor: { id: actorId, type: "STAFF" },
      action: "auth.fresh_session.failed",
      entityType: "User",
      entityId: actorId,
      after: { reason: "account_unavailable" },
      ip,
      userAgent,
      requestId,
    });
    return err("UNAUTHENTICATED", "Invalid credentials.");
  }

  // Verify password via scrypt
  const passwordMatch = await verifyPassword({
    hash: account.password,
    password: input.password,
  });

  if (!passwordMatch) {
    await audit({
      actor: { id: actorId, type: "STAFF" },
      action: "auth.fresh_session.failed",
      entityType: "User",
      entityId: actorId,
      after: { reason: "incorrect_password" },
      ip,
      userAgent,
      requestId,
    });
    return err("UNAUTHENTICATED", "Incorrect password.");
  }

  // Verify TOTP if enrolled
  if (user.twoFactorEnabled) {
    if (!input.totpCode || !/^\d{6}$/.test(input.totpCode.trim())) {
      return err("VALIDATION", "A valid 6-digit two-factor authentication code is required.");
    }

    const twoFactor = await db.twoFactor.findUnique({
      where: { userId: actorId },
      select: {
        id: true,
        secret: true,
        verified: true,
        failedVerificationCount: true,
        lockedUntil: true,
      },
    });

    if (!twoFactor || !twoFactor.verified) {
      return err("CONFLICT", "Two-factor authentication configuration is incomplete.");
    }

    if (twoFactor.lockedUntil && twoFactor.lockedUntil > new Date()) {
      return err("RATE_LIMITED", "Two-factor authentication is temporarily locked. Please try again later.");
    }

    const otp = createOTP(twoFactor.secret, { period: 30, digits: 6 });
    const totpValid = await otp.verify(input.totpCode.trim(), { window: 1 });

    if (!totpValid) {
      const nextFailures = twoFactor.failedVerificationCount + 1;
      const shouldLock = nextFailures >= MAX_TOTP_FAILURES;
      const lockedUntil = shouldLock ? new Date(Date.now() + TOTP_LOCKOUT_MS) : null;

      await db.twoFactor.update({
        where: { id: twoFactor.id },
        data: {
          failedVerificationCount: nextFailures,
          lockedUntil,
        },
      });

      await audit({
        actor: { id: actorId, type: "STAFF" },
        action: "auth.fresh_session.failed",
        entityType: "User",
        entityId: actorId,
        after: { reason: "invalid_totp", locked: shouldLock },
        ip,
        userAgent,
        requestId,
      });

      return err(
        shouldLock ? "RATE_LIMITED" : "UNAUTHENTICATED",
        shouldLock
          ? "Too many incorrect attempts. Two-factor authentication is temporarily locked."
          : "Invalid two-factor authentication code.",
      );
    }

    // Reset failed TOTP count on success
    if (twoFactor.failedVerificationCount > 0 || twoFactor.lockedUntil) {
      await db.twoFactor.update({
        where: { id: twoFactor.id },
        data: {
          failedVerificationCount: 0,
          lockedUntil: null,
        },
      });
    }
  }

  await audit({
    actor: { id: actorId, type: "STAFF" },
    action: "auth.fresh_session.verified",
    entityType: "User",
    entityId: actorId,
    after: { twoFactorVerified: user.twoFactorEnabled },
    ip,
    userAgent,
    requestId,
  });

  return ok({ verified: true });
}

