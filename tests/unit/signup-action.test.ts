import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  headers: vi.fn(),
  limit: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/server/auth", () => ({ auth: { api: { signUpEmail: mocks.signUpEmail } } }));
vi.mock("@/server/auth/post-login", () => ({ resolveUserPostLogin: vi.fn() }));
vi.mock("@/server/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/server/integrations/ratelimit", () => ({ limit: mocks.limit }));

import { signupAction } from "@/server/auth/actions";

describe("signupAction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.findUnique.mockReset();
    mocks.headers.mockReset();
    mocks.limit.mockReset();
    mocks.signUpEmail.mockReset();
  });

  it("reports success if account creation completed before a post-commit error", async () => {
    mocks.headers.mockResolvedValue(new Headers());
    mocks.limit.mockResolvedValue({ allowed: true });
    mocks.signUpEmail.mockRejectedValue(Object.assign(new Error("private details"), { code: "INTERNAL_SERVER_ERROR", status: 500 }));
    mocks.findUnique.mockResolvedValue({ id: "persisted-user" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await signupAction({
      name: "Test Customer",
      email: "customer@example.com",
      password: "secure-test-password",
      confirmPassword: "secure-test-password",
      callbackUrl: "/account",
    });

    expect(result).toEqual({ ok: true, message: "Check your email to verify your account before signing in." });
    expect(consoleError).toHaveBeenCalledWith("[auth] signup request failed", { code: "INTERNAL_SERVER_ERROR", status: 500 });
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("private details");
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("secure-test-password");
  });

  it("keeps the generic failure if no account was persisted", async () => {
    mocks.headers.mockResolvedValue(new Headers());
    mocks.limit.mockResolvedValue({ allowed: true });
    mocks.signUpEmail.mockRejectedValue(new Error("private details"));
    mocks.findUnique.mockResolvedValue(null);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await signupAction({
      name: "Test Customer",
      email: "customer@example.com",
      password: "secure-test-password",
      confirmPassword: "secure-test-password",
      callbackUrl: "/account",
    });

    expect(result).toEqual({ ok: false, message: "Unable to create your account. Please try again." });
  });
});
