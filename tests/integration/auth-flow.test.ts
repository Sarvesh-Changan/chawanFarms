// @vitest-environment node

import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

loadEnv({ path: ".env.local" });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

integrationDescribe("Better Auth customer flow", () => {
  let auth: typeof import("../../src/server/auth").auth;
  let db: typeof import("../../src/server/db").db;
  let createEmailVerificationToken: typeof import("better-auth/api").createEmailVerificationToken;
  let recordFailedLogin: typeof import("../../src/server/auth/actions").recordFailedLogin;
  let capturedResetUrl: string | undefined;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    vi.doMock("@/server/integrations/email", () => ({
      sendVerificationEmail: async () => undefined,
      sendResetPasswordEmail: async ({ url }: { url: string }) => { capturedResetUrl = url; },
    }));
    ({ auth } = await import("../../src/server/auth"));
    ({ db } = await import("../../src/server/db"));
    ({ createEmailVerificationToken } = await import("better-auth/api"));
    ({ recordFailedLogin } = await import("../../src/server/auth/actions"));
    await db.$connect();
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it("completes signup, email verification, and login", async () => {
    const email = `codex-auth-${crypto.randomUUID()}@example.com`;
    const headers = new Headers({ origin: "http://localhost:3000" });
    const signup = await auth.api.signUpEmail({ body: { name: "Auth Test", email, password: "correct horse battery" }, headers });
    expect(signup.user.emailVerified).toBe(false);

    const token = await createEmailVerificationToken(process.env.AUTH_SECRET ?? "", email, undefined, 86_400);
    await auth.api.verifyEmail({ query: { token }, headers });
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);

    const login = await auth.api.signInEmail({ body: { email, password: "correct horse battery" }, headers });
    expect(login.user.email).toBe(email);
  });

  it("locks an account after five failed login attempts", async () => {
    const user = await db.user.create({ data: { email: `codex-lock-${crypto.randomUUID()}@example.com`, name: "Lock Test", emailVerified: true } });
    for (let attempt = 0; attempt < 5; attempt += 1) await recordFailedLogin(user.id);
    const locked = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.failedLoginCount).toBe(5);
    expect(locked.lockedUntil).not.toBeNull();
  });

  it("accepts a reset token once", async () => {
    const email = `codex-reset-${crypto.randomUUID()}@example.com`;
    const headers = new Headers({ origin: "http://localhost:3000" });
    await auth.api.signUpEmail({ body: { name: "Reset Test", email, password: "correct horse battery" }, headers });
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers });
    expect(capturedResetUrl).toBeDefined();
    const token = new URL(capturedResetUrl ?? "http://localhost").pathname.split("/").at(-1);
    expect(token).toBeTruthy();

    await auth.api.resetPassword({ body: { newPassword: "another correct password", token }, headers });
    await expect(auth.api.resetPassword({ body: { newPassword: "third correct password", token }, headers })).rejects.toThrow();
  });
});
