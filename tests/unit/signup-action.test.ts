import { describe, expect, it } from "vitest";

import { signupAction } from "@/server/auth/actions";

describe("signupAction (server enforcement)", () => {
  it("rejects customer email/password sign-up with generic error because Google sign-in is required", async () => {
    const result = await signupAction({
      name: "Test Customer",
      email: "customer@example.com",
      password: "secure-test-password",
      confirmPassword: "secure-test-password",
      callbackUrl: "/account",
    });

    expect(result).toEqual({
      ok: false,
      message: "Unable to sign in. Check your details and try again.",
    });
  });
});
