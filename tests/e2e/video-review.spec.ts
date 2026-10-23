import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.RUN_VIDEO_REVIEW_E2E === "1" &&
  process.env.CLOUDINARY_TEST_MODE === "1" &&
  process.env.VIDEO_E2E_CUSTOMER_EMAIL &&
  process.env.VIDEO_E2E_CUSTOMER_PASSWORD &&
  process.env.VIDEO_E2E_STAFF_EMAIL &&
  process.env.VIDEO_E2E_STAFF_PASSWORD,
);

test.describe("customer video to booking coupon flow", () => {
  test.skip(!configured, "Set RUN_VIDEO_REVIEW_E2E=1 and the documented test credentials to run with the Cloudinary test stub.");

  test("upload → pending → approve → points → redeem → quote applies coupon", async ({ page }) => {
    // The test environment must set CLOUDINARY_TEST_MODE=1; the server-side
    // Cloudinary adapter is stubbed there, so no real credentials or asset is used.
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.VIDEO_E2E_CUSTOMER_EMAIL as string);
    await page.getByLabel(/password/i).fill(process.env.VIDEO_E2E_CUSTOMER_PASSWORD as string);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.goto("/account/videos/new");
    await page.getByLabel(/visit date/i).fill("19/10/2026");
    await page.getByLabel(/ownership|permission/i).check();
    await page.getByRole("button", { name: /upload|submit/i }).click();
    await expect(page.getByText(/pending/i)).toBeVisible();

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.VIDEO_E2E_STAFF_EMAIL as string);
    await page.getByLabel(/password/i).fill(process.env.VIDEO_E2E_STAFF_PASSWORD as string);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.goto("/admin/rewards/videos");
    await page.getByRole("button", { name: /review/i }).first().click();
    await page.getByRole("button", { name: /approve/i }).click();
    await page.getByRole("button", { name: /confirm/i }).click();
    await expect(page.getByText(/points awarded/i)).toBeVisible();

    await page.goto("/account/rewards");
    await page.getByRole("button", { name: /redeem/i }).click();
    await page.goto("/account/bookings/new");
    await expect(page.getByText(/coupon/i)).toBeVisible();
    await page.getByLabel(/coupon/i).fill("test-coupon");
    await expect(page.getByText(/applied/i)).toBeVisible();
  });
});
