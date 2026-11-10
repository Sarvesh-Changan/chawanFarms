import "server-only";

import { createHash } from "node:crypto";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/config/env";
import { validateGoogleUserInfo } from "@/server/auth/google-gate";
import { ensureCustomerProfile } from "@/server/auth/referral";
import { db } from "@/server/db";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/server/integrations/email";
import { clearRateLimit } from "@/server/integrations/ratelimit";

function accountLoginRateLimitKey(email: string): string {
  return `auth:login:account:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}

function getTrustedOrigins(): string[] {
  const origins = new Set<string>();

  // Always trust development origins
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");

  // Always trust production domain and its www/non-www variants
  origins.add("https://www.chawanfarms.com");
  origins.add("https://chawanfarms.com");

  // Add NEXT_PUBLIC_SITE_URL and its www/non-www variant
  if (env.NEXT_PUBLIC_SITE_URL) {
    const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
    origins.add(siteUrl);
    try {
      const parsed = new URL(siteUrl);
      if (parsed.hostname.startsWith("www.")) {
        origins.add(`${parsed.protocol}//${parsed.hostname.slice(4)}${parsed.port ? `:${parsed.port}` : ""}`);
      } else if (!parsed.hostname.includes("localhost") && !parsed.hostname.includes("127.0.0.1")) {
        origins.add(`${parsed.protocol}//www.${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`);
      }
    } catch {
      // ignore
    }
  }

  // Add all explicitly configured origins from AUTH_TRUSTED_ORIGINS
  if (env.AUTH_TRUSTED_ORIGINS) {
    for (const raw of env.AUTH_TRUSTED_ORIGINS.split(",")) {
      const trimmed = raw.trim().replace(/\/+$/, "");
      if (trimmed) {
        origins.add(trimmed);
        try {
          const parsed = new URL(trimmed);
          if (parsed.hostname.startsWith("www.")) {
            origins.add(`${parsed.protocol}//${parsed.hostname.slice(4)}${parsed.port ? `:${parsed.port}` : ""}`);
          } else if (!parsed.hostname.includes("localhost") && !parsed.hostname.includes("127.0.0.1")) {
            origins.add(`${parsed.protocol}//www.${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // Support Vercel deployment preview and production URLs if present
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  return Array.from(origins);
}

function getBaseUrl(): string {
  if (
    (env.APP_ENV === "production" || process.env.NODE_ENV === "production") &&
    (!env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_SITE_URL.includes("localhost"))
  ) {
    return "https://www.chawanfarms.com";
  }
  return env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const auth = betterAuth({
  appName: "Chawan Farms",
  secret: env.AUTH_SECRET,
  baseURL: getBaseUrl(),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(),
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID || "google-client-id-placeholder",
      clientSecret: env.GOOGLE_CLIENT_SECRET || "google-client-secret-placeholder",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  user: {
    validateUserInfo: validateGoogleUserInfo,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 1_800,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      try {
        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null },
        });
        await clearRateLimit(accountLoginRateLimitKey(user.email));
      } catch (error) {
        // The password has already been changed; cleanup must not turn a
        // successful reset into a misleading "invalid link" response.
        console.error("[auth] failed to clear login lockout after password reset", error);
      }
    },
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({ to: user.email, name: user.name, url });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 86_400,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, name: user.name, url });
    },
  },
  verification: { storeIdentifier: "hashed" },
  session: {
    expiresIn: 2_592_000,
    updateAge: 86_400,
    freshAge: 86_400,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: env.APP_ENV !== "development",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.APP_ENV !== "development",
      path: "/",
    },
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              name: user.name || "Customer",
              email: user.email.toLowerCase(),
              image: user.image ?? null,
              type: user.type ?? "CUSTOMER",
              status: user.status ?? "ACTIVE",
            },
          };
        },
        after: async (user) => {
          try {
            const persistedUser = await db.user.findUnique({
              where: { id: user.id },
              select: { type: true },
            });
            if (persistedUser?.type === "CUSTOMER") {
              await ensureCustomerProfile(user.id);
              await db.consentRecord.create({
                data: {
                  userId: user.id,
                  purpose: "privacy",
                  granted: true,
                  policyVersion: "2026-v1",
                },
              }).catch(() => undefined);
            }
          } catch (error) {
            const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{1,32}$/.test(error.code)
              ? error.code
              : undefined;
            console.error("[auth] customer profile provisioning failed", code ? { code } : undefined);
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await db.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
        },
      },
    },
  },
  plugins: [
    nextCookies(),
  ],
});

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) return null;

  // Enforce staff session timeouts: 8 hours idle, 24 hours absolute maximum
  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { type: true, status: true, deletedAt: true },
    });

    if (user?.type === "STAFF") {
      if (user.status !== "ACTIVE" || user.deletedAt) {
        await db.session.deleteMany({ where: { token: session.session.token } });
        return null;
      }

      const now = Date.now();
      const createdAt = new Date(session.session.createdAt).getTime();
      const updatedAt = new Date(session.session.updatedAt).getTime();
      const absoluteTimeoutMs = 24 * 60 * 60 * 1000; // 24 hours
      const idleTimeoutMs = 8 * 60 * 60 * 1000; // 8 hours

      if (now - createdAt > absoluteTimeoutMs || now - updatedAt > idleTimeoutMs) {
        await db.session.deleteMany({ where: { token: session.session.token } });
        return null;
      }

      // Update session updatedAt to track sliding idle window if > 5 minutes since last touch
      if (now - updatedAt > 5 * 60 * 1000) {
        await db.session.update({
          where: { token: session.session.token },
          data: { updatedAt: new Date() },
        }).catch(() => undefined);
      }
    }
  } catch (error) {
    console.error("[auth] error verifying staff session lifecycle", error);
  }

  return session;
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=/account");
  return session;
}

export async function requireCustomer() {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=/account");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { type: true } });
  if (user?.type === "STAFF") redirect("/admin");
  if (user?.type !== "CUSTOMER") redirect("/login");
  return session;
}
