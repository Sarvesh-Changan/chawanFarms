import { expect, test } from "@playwright/test";

test("health endpoint returns 200", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});
