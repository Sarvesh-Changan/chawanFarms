import { describe, expect, it } from "vitest";

import { isSafeCallbackUrl, safeCallbackUrl } from "../../src/lib/safe-url";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "../../src/lib/schemas/auth";

describe("authentication schemas", () => {
  it("requires a ten-character password and matching signup passwords", () => {
    expect(signupSchema.safeParse({ name: "A", email: "bad", password: "short", confirmPassword: "different" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "Asha Singh", email: "asha@example.com", password: "correct horse battery", confirmPassword: "correct horse battery" }).success).toBe(true);
  });

  it("validates login and reset inputs strictly", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "correct horse" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "token", password: "new password", confirmPassword: "different" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "token", password: "new password", confirmPassword: "new password" }).success).toBe(true);
  });
});

describe("callback URL safety", () => {
  it("accepts relative paths and rejects open redirects", () => {
    expect(safeCallbackUrl("/account/bookings")).toBe("/account/bookings");
    expect(isSafeCallbackUrl("https://evil.example")).toBe(false);
    expect(safeCallbackUrl("//evil.example", "/account")).toBe("/account");
    expect(safeCallbackUrl("https://evil.example", "/account")).toBe("/account");
  });
});
