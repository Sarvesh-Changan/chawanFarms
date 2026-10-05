import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/config/env";
import { ensureCustomerProfile } from "@/server/auth/referral";
import { db } from "@/server/db";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/server/integrations/email";

export const auth = betterAuth({
  appName: "Chawan Farms",
  secret: env.AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_SITE_URL,
  basePath: "/api/auth",
  trustedOrigins: env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 1_800,
    revokeSessionsOnPasswordReset: true,
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
        after: async (user) => {
          const persistedUser = await db.user.findUnique({
            where: { id: user.id },
            select: { type: true },
          });
          if (persistedUser?.type === "CUSTOMER") await ensureCustomerProfile(user.id);
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
    twoFactor({
      issuer: "Chawan Farms",
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
    }),
    nextCookies(),
  ],
});

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=/account");
  return session;
}
