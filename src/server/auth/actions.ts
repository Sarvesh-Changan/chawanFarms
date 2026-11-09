"use server";

import { createHash } from "node:crypto";

import { verifyPassword } from "@better-auth/utils/password";
import { headers } from "next/headers";
import { z } from "zod";

import {
  loginSchema,
  resetPasswordSchema,
  staffForgotPasswordSchema,
  staffResetPasswordSchema,
  staffVerifyOtpSchema,
} from "@/lib/schemas/auth";
import { auth } from "@/server/auth";
import { resolveUserPostLogin } from "@/server/auth/post-login";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string;
  retryAfterSeconds?: number;
  grantToken?: string;
};

const genericLoginError = "Unable to sign in. Check your details and try again.";
const genericResetError = "If the details are valid, you will receive an email shortly.";

// Pre-computed scrypt hash used to ensure constant-time verification for non-existent or locked accounts
const DUMMY_SCRYPT_HASH =
  "fce2f109a6370b0341a73facd12a2268:fe3c6b42cd86ee5811c4c9941f579247c2e71abfdc7dc7515a437cc99683d5c4591cefbc523ff656d428a6128024dccdfb9599f351cb3a276978261c6717fbf9";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors = new Map<string, string[]>();
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    errors.set(field, [...(errors.get(field) ?? []), issue.message]);
  }
  return Object.fromEntries(errors);
}

function emailKey(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

function clientIp(requestHeaders: Headers): string {
  for (const header of ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const value = requestHeaders.get(header)?.split(",")[0]?.trim();
    if (value && /^[0-9a-fA-F:.]{3,128}$/.test(value)) return value;
  }
  return "unknown";
}

function limited(result: Awaited<ReturnType<typeof limit>>): AuthActionResult | null {
  if (result.allowed) return null;
  return {
    ok: false,
    message: "Too many attempts. Please try again later.",
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

async function accountState(email: string) {
  return db.user.findUnique({
    where: { email },
    select: { id: true, type: true, emailVerified: true, failedLoginCount: true, lockedUntil: true },
  });
}

export async function recordFailedLogin(userId: string): Promise<void> {
  await db.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: { increment: 1 },
      },
      select: { failedLoginCount: true },
    });
    if (user.failedLoginCount >= 5) {
      await transaction.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
      });
    }
  });
}

export async function loginAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const rawEmail = typeof rawInput === "object" && rawInput !== null && "email" in rawInput && typeof rawInput.email === "string"
    ? rawInput.email.trim().toLowerCase()
    : "invalid";
  const [ipLimit, accountLimit] = await Promise.all([
    limit(`auth:login:ip:${ip}`, 20, 900),
    limit(`auth:login:account:${emailKey(rawEmail)}`, 5, 900),
  ]);
  const limitedResult = limited(ipLimit) ?? limited(accountLimit);
  if (limitedResult) return limitedResult;

  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const user = await accountState(parsed.data.email);

  // Admin password login accepts ONLY staff accounts. Customer password sign-in is disabled.
  if (!user || user.type !== "STAFF") {
    // Constant-time execution for non-staff or non-existent accounts
    await verifyPassword(DUMMY_SCRYPT_HASH, parsed.data.password).catch(() => false);
    return { ok: false, message: genericLoginError };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    // Constant-time execution for locked admin accounts
    await verifyPassword(DUMMY_SCRYPT_HASH, parsed.data.password).catch(() => false);
    return { ok: false, message: genericLoginError };
  }

  try {
    const signInResult = await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password, callbackURL: "/" },
      headers: requestHeaders,
    });
    const needsTwoFactorVerify = Boolean((signInResult as { twoFactorRedirect?: boolean })?.twoFactorRedirect);
    const signInUserId = "user" in signInResult && signInResult.user && "id" in signInResult.user && typeof signInResult.user.id === "string"
      ? signInResult.user.id
      : needsTwoFactorVerify ? user?.id : undefined;
    if (!signInUserId) return { ok: false, message: genericLoginError };

    // Session rotation on login: purge any prior stale session on this connection
    const cookieHeader = requestHeaders.get("cookie");
    const priorSessionMatch = cookieHeader?.match(/better-auth\.session_token=([^;]+)/);
    if (priorSessionMatch?.[1]) {
      const priorToken = decodeURIComponent(priorSessionMatch[1]);
      await db.session.deleteMany({
        where: { token: priorToken, userId: { not: signInUserId } },
      }).catch(() => undefined);
    }

    const destination = await resolveUserPostLogin(signInUserId, parsed.data.callbackUrl, { needsTwoFactorVerify });
    if (!destination) return { ok: false, message: genericLoginError };
    return { ok: true, redirectTo: destination.redirectTo };
  } catch {
    if (user?.emailVerified) await recordFailedLogin(user.id);
    return { ok: false, message: genericLoginError };
  }
}

export async function signupAction(_rawInput?: unknown): Promise<AuthActionResult> {
  void _rawInput;
  // Customer email/password registration is disabled; users authenticate via Google.
  return { ok: false, message: genericLoginError };
}

export async function forgotPasswordAction(_rawInput?: unknown): Promise<AuthActionResult> {
  void _rawInput;
  // Customer password reset is disabled; users authenticate via Google. Staff uses OTP reset.
  return { ok: false, message: genericResetError };
}

export async function resetPasswordAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const ipLimit = await limit(`auth:reset-password:ip:${ip}`, 10, 3_600);
  const limitedResult = limited(ipLimit);
  if (limitedResult) return limitedResult;

  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: requestHeaders,
    });
    return { ok: true, message: "Your password has been reset. You can now sign in." };
  } catch {
    return { ok: false, message: "This reset link is invalid or expired." };
  }
}

export async function logoutAction(): Promise<{ ok: boolean; redirectTo: string }> {
  const requestHeaders = await headers();
  try {
    await auth.api.signOut({
      headers: requestHeaders,
    });
  } catch {
    // Session may already be expired or revoked
  }
  return { ok: true, redirectTo: "/login" };
}

export async function requestStaffResetOtpAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);

  const parsed = staffForgotPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const { requestStaffPasswordReset } = await import("@/server/auth/staff-password-reset");
  const result = await requestStaffPasswordReset(parsed.data.email, ip);
  return {
    ok: result.ok,
    message: result.message,
    retryAfterSeconds: result.cooldownRemainingSeconds,
  };
}

export async function verifyStaffResetOtpAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);

  const parsed = staffVerifyOtpSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const { verifyStaffResetOtp } = await import("@/server/auth/staff-password-reset");
  const result = await verifyStaffResetOtp(parsed.data.email, parsed.data.code, ip);
  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }

  return {
    ok: true,
    message: "Code verified. Please choose a new password.",
    grantToken: result.data.grantToken,
  };
}

export async function completeStaffResetPasswordAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);

  const parsed = staffResetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const { completeStaffPasswordReset } = await import("@/server/auth/staff-password-reset");
  const result = await completeStaffPasswordReset(parsed.data.grantToken, parsed.data.password, ip);
  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }

  return {
    ok: true,
    message: "Your password has been changed. You can now sign in.",
    redirectTo: "/admin/login?callbackUrl=%2Fadmin",
  };
}
