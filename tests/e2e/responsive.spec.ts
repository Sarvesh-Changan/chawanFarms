import { expect, test } from "@playwright/test";

const routes = ["/", "/packages", "/gallery", "/contact", "/book", "/login"];
const widths = [360, 390, 768];

for (const width of widths) {
  test.describe(`responsive public pages at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: width < 500, hasTouch: true });

    for (const route of routes) {
      test(`${route} has no mobile layout regressions`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("main")).toBeVisible();

        const metrics = await page.evaluate(() => {
          const visible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          };
          const controls = [...document.querySelectorAll("a,button,input,select,textarea,[role=button],[role=switch],[aria-haspopup]")].filter(visible);
          const undersizedControls = controls.filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          }).length;
          const undersizedInputs = [...document.querySelectorAll("input,select,textarea")].filter(visible)
            .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 16).length;
          const placeholders = [...document.querySelectorAll("body *")].filter(visible)
            .filter((element) => element.children.length === 0 && /placeholder|crops\s*&\s*trees|farm cottages/i.test(element.textContent ?? "")).length;
          const eyebrowMarkers = [...document.querySelectorAll("[data-section-eyebrow], main p")].filter(visible)
            .filter((element) => /^\s*\/\/\s*\/\//.test(element.textContent ?? "")).length;
          return {
            viewportWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            undersizedControls,
            undersizedInputs,
            placeholders,
            eyebrowMarkers,
          };
        });

        expect(metrics.scrollWidth, `${route} at ${width}px should not overflow horizontally`).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.undersizedControls, `${route} has controls below 44px`).toBe(0);
        expect(metrics.undersizedInputs, `${route} has form fields below 16px`).toBe(0);
        expect(metrics.placeholders, `${route} has a visible image placeholder label`).toBe(0);
        expect(metrics.eyebrowMarkers, `${route} has a duplicated eyebrow marker`).toBe(0);
      });
    }
  });
}
