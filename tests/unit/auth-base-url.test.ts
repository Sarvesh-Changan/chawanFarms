import { describe, expect, it } from "vitest";

import { googleCallbackUrl, resolveAuthBaseUrl } from "@/server/auth/base-url";

describe("Better Auth base URL", () => {
  it("keeps local development on localhost", () => {
    expect(resolveAuthBaseUrl({ configuredUrl: "http://localhost:3000/", appEnvironment: "development", nodeEnvironment: "development" })).toBe("http://localhost:3000");
  });

  it("uses the canonical HTTPS domain when a production deploy has a local or insecure URL", () => {
    expect(resolveAuthBaseUrl({ configuredUrl: "http://localhost:3000", appEnvironment: "preview", nodeEnvironment: "production" })).toBe("https://www.chawanfarms.com");
    expect(resolveAuthBaseUrl({ configuredUrl: "http://www.chawanfarms.com", appEnvironment: "production", nodeEnvironment: "production" })).toBe("https://www.chawanfarms.com");
    expect(resolveAuthBaseUrl({ configuredUrl: "http://preview.example", appEnvironment: "production", nodeEnvironment: "production" })).toBe("https://www.chawanfarms.com");
  });

  it("keeps a configured HTTPS production domain and builds the exact Better Auth callback", () => {
    const baseUrl = resolveAuthBaseUrl({ configuredUrl: "https://chawanfarms.com/", appEnvironment: "production", nodeEnvironment: "production" });
    expect(baseUrl).toBe("https://chawanfarms.com");
    expect(googleCallbackUrl(baseUrl)).toBe("https://chawanfarms.com/api/auth/callback/google");
  });
});
