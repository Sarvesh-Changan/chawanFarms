"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";
import { z } from "zod";

import { safeCallbackUrl } from "@/lib/safe-url";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/schemas/auth";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";
import { verifyTurnstileToken } from "@/server/integrations/turnstile";

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string;
  retryAfterSeconds?: number;
};

const genericLoginError = "Unable to sign in. Check your details and try again.";
const genericResetError = "If the details are valid, you will receive an email shortly.";

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
    select: { id: true, emailVerified: true, failedLoginCount: true, lockedUntil: true },
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
  if (limitedResult) return { ...limitedResult, message: genericLoginError };

  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const user = await accountState(parsed.data.email);
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, message: genericLoginError };
  }

  const needsTurnstile = (user?.failedLoginCount ?? 0) >= 3 || ipLimit.remaining <= 16;
  if (needsTurnstile && !(await verifyTurnstileToken(parsed.data.turnstileToken, ip))) {
    return { ok: false, message: genericLoginError };
  }

  const redirectTo = safeCallbackUrl(parsed.data.callbackUrl, "/account");
  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password, callbackURL: redirectTo },
      headers: requestHeaders,
    });
    return { ok: true, redirectTo };
  } catch {
    if (user?.emailVerified) await recordFailedLogin(user.id);
    return { ok: false, message: genericLoginError };
  }
}

export async function signupAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const ipLimit = await limit(`auth:signup:ip:${ip}`, 5, 3_600);
  const limitedResult = limited(ipLimit);
  if (limitedResult) return limitedResult;

  const parsed = signupSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  if (!(await verifyTurnstileToken(parsed.data.turnstileToken, ip))) {
    return { ok: false, message: "Please complete the security check." };
  }

  try {
    await auth.api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password, callbackURL: "/verify-email" },
      headers: requestHeaders,
    });
    return { ok: true, message: "Check your email to verify your account before signing in." };
  } catch {
    return { ok: false, message: "Unable to create your account. Please try again." };
  }
}

export async function forgotPasswordAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const rawEmail = typeof rawInput === "object" && rawInput !== null && "email" in rawInput && typeof rawInput.email === "string"
    ? rawInput.email.trim().toLowerCase()
    : "invalid";
  const [ipLimit, emailLimit] = await Promise.all([
    limit(`auth:forgot-password:ip:${ip}`, 10, 3_600),
    limit(`auth:forgot-password:email:${emailKey(rawEmail)}`, 3, 3_600),
  ]);
  const limitedResult = limited(ipLimit) ?? limited(emailLimit);
  if (limitedResult) return limitedResult;

  const parsed = forgotPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  if (!(await verifyTurnstileToken(parsed.data.turnstileToken, ip))) {
    return { ok: false, message: genericResetError };
  }

  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: requestHeaders,
    });
  } catch {
    // Deliberately keep the same response for existing and unknown addresses.
  }
  return { ok: true, message: genericResetError };
}

export async function resetPasswordAction(rawInput: unknown): Promise<AuthActionResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const ipLimit = await limit(`auth:reset-password:ip:${ip}`, 10, 3_600);
  const limitedResult = limited(ipLimit);
  if (limitedResult) return limitedResult;

  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  if (!(await verifyTurnstileToken(parsed.data.turnstileToken, ip))) {
    return { ok: false, message: "Please complete the security check." };
  }

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
