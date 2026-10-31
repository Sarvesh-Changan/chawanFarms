import { expect, test } from "@playwright/test";

test.describe("visitor Home composition", () => {
  test("presents one primary title and a clear Plan your stay path", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator('a[href="/book"]', { hasText: "Plan your stay" }).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText("No published packages are available");
    await expect(page.locator("main")).not.toContainText("No published activities are available");
    await expect(page.locator("main")).not.toContainText("No published food items are available");
  });

  test("keeps hidden reveals and route motion static when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator('[data-reveal-state="hidden"]')).toHaveCount(0);
    const durations = await page.locator("main").evaluate((element) => {
      const reveal = element.querySelector('[data-reveal-state="visible"]');
      return reveal ? getComputedStyle(reveal).transitionDuration : "0s";
    });
    expect(["0s", "0.01ms", "1e-05s"]).toContain(durations);
  });

  test("shows the mobile quick-contact bar after the hero clears the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator('nav[aria-label="Quick contact"]')).toHaveCount(0);
    await page.locator("#hero").evaluate((hero) => window.scrollTo(0, hero.getBoundingClientRect().height + 120));
    await expect(page.locator('nav[aria-label="Quick contact"]')).toBeVisible();
  });

  test("navigates between public routes without a hidden-document transition error", async ({ page }) => {
    const transitionErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /InvalidStateError|Document hidden|Transition was aborted/i.test(message.text())) {
        transitionErrors.push(message.text());
      }
    });
    await page.goto("/");
    await page.getByRole("link", { name: "Gallery", exact: true }).first().click();
    await expect(page).toHaveURL(/\/gallery$/);
    expect(transitionErrors).toEqual([]);
  });
});
