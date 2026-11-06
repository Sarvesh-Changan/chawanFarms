import "server-only";

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "@/config/env";
import { validateAdminPassword } from "@/lib/auth/password-policy";
import { err, ok, type Result } from "@/lib/result";
import { db } from "@/server/db";
import { sendEmailMessage } from "@/server/integrations/email";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GRANT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_OTP_ATTEMPTS = 5;

export const NEUTRAL_RESET_MESSAGE =
  "If an eligible staff account is registered with this address, a verification code has been sent.";

function emailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function otpIdentifier(email: string): string {
  return `staff-reset-otp:${emailKey(email)}`;
}

function grantIdentifier(grantToken: string): string {
  return `staff-reset-grant:${createHash("sha256").update(grantToken.trim()).digest("hex")}`;
}

function hashOtp(code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(code.trim()).digest("hex");
}

type OtpValue = {
  hmac: string;
  attempts: number;
  userId: string;
  createdAt: number;
};

type GrantValue = {
  userId: string;
  email: string;
  createdAt: number;
};

/**
 * Initiates an email OTP password reset for staff accounts.
 * Always returns a neutral message to prevent account enumeration.
 */
export async function requestStaffPasswordReset(
  emailInput: string,
  clientIp: string,
): Promise<{ ok: boolean; message: string; cooldownRemainingSeconds?: number }> {
  const normalizedEmail = emailInput.trim().toLowerCase();
  const eKey = emailKey(normalizedEmail);

  // Rate limit: 5 sends per hour per IP and per account
  const [ipLimit, accountLimit] = await Promise.all([
    limit(`auth:staff-reset-otp:ip:${clientIp}`, 5, 3600),
    limit(`auth:staff-reset-otp:email:${eKey}`, 5, 3600),
  ]);

  if (!ipLimit.allowed || !accountLimit.allowed) {
    return {
      ok: false,
      message: "Too many reset attempts. Please try again later.",
    };
  }

  // Lookup user: must be active STAFF
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, type: true, status: true, deletedAt: true },
  });

  if (!user || user.type !== "STAFF" || user.status !== "ACTIVE" || user.deletedAt) {
    // Neutral response: do not reveal that user does not exist or is not staff
    return { ok: true, message: NEUTRAL_RESET_MESSAGE };
  }

  const idKey = otpIdentifier(normalizedEmail);

  // Check 60s cooldown
  const existingOtp = await db.verification.findFirst({
    where: { identifier: idKey },
    orderBy: { createdAt: "desc" },
  });

  if (existingOtp) {
    const elapsedMs = Date.now() - existingOtp.createdAt.getTime();
    if (elapsedMs < SEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((SEND_COOLDOWN_MS - elapsedMs) / 1000);
      return {
        ok: false,
        message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        cooldownRemainingSeconds: remainingSeconds,
      };
    }
    // Invalidate existing codes for this user
    await db.verification.deleteMany({ where: { identifier: idKey } });
  }

  // Generate 6-digit CSPRNG code
  const code = randomInt(100_000, 1_000_000).toString();
  const codeHmac = hashOtp(code);

  const otpPayload: OtpValue = {
    hmac: codeHmac,
    attempts: 0,
    userId: user.id,
    createdAt: Date.now(),
  };

  await db.verification.create({
    data: {
      identifier: idKey,
      value: JSON.stringify(otpPayload),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  // CDS-compliant email: short, no "successfully", clear code, 10 min expiry, ignore if unrequested
  const emailText = [
    `Your one-time password reset code is: ${code}`,
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, ignore this email.",
  ].join("\n");

  const emailHtml = [
    "<p>Your one-time password reset code is: <strong>" + code + "</strong></p>",
    "<p>This code expires in 10 minutes.</p>",
    "<p>If you did not request this, ignore this email.</p>",
  ].join("");

  await sendEmailMessage({
    type: "staff-password-reset-otp",
    to: user.email,
    subject: "Chawan Farms staff password reset code",
    text: emailText,
    html: emailHtml,
    transactional: true,
  });

  return { ok: true, message: NEUTRAL_RESET_MESSAGE };
}

/**
 * Validates the 6-digit OTP code in constant time.
 * If valid, deletes the OTP and returns a short-lived single-use grant token.
 */
export async function verifyStaffResetOtp(
  emailInput: string,
  codeInput: string,
  clientIp: string,
): Promise<Result<{ grantToken: string }>> {
  const normalizedEmail = emailInput.trim().toLowerCase();
  const idKey = otpIdentifier(normalizedEmail);

  // Rate limit verification attempts: 20 per 15 min per IP
  const rateLimit = await limit(`auth:staff-reset-verify:ip:${clientIp}`, 20, 900);
  if (!rateLimit.allowed) {
    return err("RATE_LIMITED", "Too many verification attempts. Please try again later.");
  }

  const record = await db.verification.findFirst({
    where: { identifier: idKey },
  });

  if (!record || record.expiresAt < new Date()) {
    if (record) await db.verification.delete({ where: { id: record.id } }).catch(() => undefined);
    return err("VALIDATION", "Invalid or expired verification code.");
  }

  let payload: OtpValue;
  try {
    payload = JSON.parse(record.value) as OtpValue;
  } catch {
    await db.verification.delete({ where: { id: record.id } }).catch(() => undefined);
    return err("VALIDATION", "Invalid or expired verification code.");
  }

  // Attempt limit: 5 wrong attempts then invalidate
  if (payload.attempts >= MAX_OTP_ATTEMPTS) {
    await db.verification.delete({ where: { id: record.id } }).catch(() => undefined);
    return err("VALIDATION", "Too many incorrect attempts. Please request a new code.");
  }

  const candidateHmac = hashOtp(codeInput.trim());
  const match = candidateHmac.length === payload.hmac.length &&
    timingSafeEqual(Buffer.from(candidateHmac), Buffer.from(payload.hmac));

  if (!match) {
    const updatedAttempts = payload.attempts + 1;
    if (updatedAttempts >= MAX_OTP_ATTEMPTS) {
      await db.verification.delete({ where: { id: record.id } }).catch(() => undefined);
      return err("VALIDATION", "Too many incorrect attempts. Please request a new code.");
    }

    await db.verification.update({
      where: { id: record.id },
      data: {
        value: JSON.stringify({ ...payload, attempts: updatedAttempts }),
      },
    });

    return err("VALIDATION", "Invalid or expired verification code.");
  }

  // Code matches: invalidate OTP immediately (single use)
  await db.verification.delete({ where: { id: record.id } });

  // Issue short-lived (15 min) single-use reset grant bound to account
  const grantToken = randomBytes(32).toString("hex");
  const grantPayload: GrantValue = {
    userId: payload.userId,
    email: normalizedEmail,
    createdAt: Date.now(),
  };

  await db.verification.create({
    data: {
      identifier: grantIdentifier(grantToken),
      value: JSON.stringify(grantPayload),
      expiresAt: new Date(Date.now() + GRANT_TTL_MS),
    },
  });

  return ok({ grantToken });
}

/**
 * Completes staff password reset using the single-use grant token.
 * Enforces the password policy, hashes via scrypt, revokes all sessions,
 * sends confirmation email, and writes an audit log.
 */
export async function completeStaffPasswordReset(
  grantTokenInput: string,
  newPasswordInput: string,
  clientIp: string,
): Promise<Result<{ ok: true }>> {
  const gIdentifier = grantIdentifier(grantTokenInput.trim());

  const grantRecord = await db.verification.findFirst({
    where: { identifier: gIdentifier },
  });

  if (!grantRecord || grantRecord.expiresAt < new Date()) {
    if (grantRecord) await db.verification.delete({ where: { id: grantRecord.id } }).catch(() => undefined);
    return err("VALIDATION", "This password reset session has expired. Please request a new code.");
  }

  // Invalidate grant token immediately (single use)
  await db.verification.delete({ where: { id: grantRecord.id } });

  let grant: GrantValue;
  try {
    grant = JSON.parse(grantRecord.value) as GrantValue;
  } catch {
    return err("VALIDATION", "Invalid password reset session.");
  }

  // Enforce password policy: min 12, max 128, reject 1,000 common passwords, reject email local part
  const policy = validateAdminPassword(newPasswordInput, grant.email);
  if (!policy.valid) {
    return err("VALIDATION", policy.reason);
  }

  // Hash using Better Auth's scrypt implementation
  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword(newPasswordInput);

  // Update password, reset lockout, revoke ALL sessions
  await db.$transaction(async (tx) => {
    const existingAccount = await tx.account.findFirst({
      where: { userId: grant.userId, providerId: "credential" },
    });

    if (existingAccount) {
      await tx.account.update({
        where: { id: existingAccount.id },
        data: { password: hashedPassword },
      });
    } else {
      await tx.account.create({
        data: {
          userId: grant.userId,
          providerId: "credential",
          accountId: grant.userId,
          password: hashedPassword,
        },
      });
    }

    await tx.user.update({
      where: { id: grant.userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // Revoke all existing sessions across all devices
    await tx.session.deleteMany({
      where: { userId: grant.userId },
    });
  });

  // Write audit log entry
  await audit({
    actor: { id: grant.userId, type: "STAFF" },
    action: "auth.staff_password_reset",
    entityType: "User",
    entityId: grant.userId,
    ip: clientIp,
  });

  // Send transactional confirmation email
  await sendEmailMessage({
    type: "staff-password-reset-complete",
    to: grant.email,
    subject: "Your Chawan Farms password was changed",
    text: [
      "The password for your Chawan Farms staff account has been changed.",
      "If you did not make this change, please contact an administrator immediately.",
    ].join("\n"),
    html: [
      "<p>The password for your Chawan Farms staff account has been changed.</p>",
      "<p>If you did not make this change, please contact an administrator immediately.</p>",
    ].join(""),
    transactional: true,
  });

  return ok({ ok: true });
}

