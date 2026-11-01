import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser } from "@playwright/test";

const baseUrl = process.env.UI_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.resolve("docs/qa/ui-audit/after");
const routes = [
  { path: "/", name: "home" },
  { path: "/packages", name: "packages" },
  { path: "/accommodation", name: "accommodation" },
  { path: "/activities", name: "activities" },
  { path: "/stories", name: "stories" },
  { path: "/gallery", name: "gallery" },
  { path: "/contact", name: "contact" },
] as const;
const viewports = [
  { name: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
] as const;
const overflowWidths = [360, 390, 768, 1024, 1440] as const;
type Metrics = Record<string, unknown>;
const pageMetrics: Metrics[] = [];

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser: Browser = await chromium.launch({ headless: true });
  const report: Metrics[] = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    for (const route of routes) {
      const response = await page.goto(new URL(route.path, baseUrl).toString(), {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(400);
      const base = `${route.name}-${viewport.name}`;
      const pageMeasurement = await page.evaluate(() => {
        const main = document.querySelector("main");
        const headingValues = Array.from(
          document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
          (heading) => heading.textContent?.trim().replace(/\s+/g, " ") ?? ""
        ).filter(Boolean);
        const headingCounts = new Map<string, number>();
        headingValues.forEach((heading) =>
          headingCounts.set(heading, (headingCounts.get(heading) ?? 0) + 1)
        );
        const paragraphs = Array.from(
          document.querySelectorAll("p"),
          (paragraph) => paragraph.textContent?.trim().replace(/\s+/g, " ") ?? ""
        ).filter((paragraph) => paragraph.length > 30);
        const paragraphCounts = new Map<string, number>();
        paragraphs.forEach((paragraph) =>
          paragraphCounts.set(paragraph, (paragraphCounts.get(paragraph) ?? 0) + 1)
        );
        const mainSections = main
          ? Array.from(main.querySelectorAll("section")).filter(
              (section) => !section.parentElement?.closest("section")
            )
          : [];
        const sectionRects = mainSections
          .map((section) => section.getBoundingClientRect())
          .sort((a, b) => a.top - b.top);
        const largeGaps: Array<{ pixels: number; screens: number }> = [];
        let previousSection: DOMRect | undefined;
        for (const rect of sectionRects) {
          if (previousSection) {
            const gap = rect.top - previousSection.bottom;
            if (gap > window.innerHeight * 0.75) {
              largeGaps.push({
                pixels: Math.round(gap),
                screens: Number((gap / window.innerHeight).toFixed(2)),
              });
            }
          }
          previousSection = rect;
        }
        const images = Array.from(document.images);
        return {
          h1Count: document.querySelectorAll("h1").length,
          emptyHeadings: Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(
            (heading) => !heading.textContent?.trim()
          ).length,
          duplicateHeadings: Array.from(headingCounts)
            .filter(([, count]) => count > 1)
            .map(([heading, count]) => ({ heading, count })),
          duplicateParagraphs: Array.from(paragraphCounts)
            .filter(([, count]) => count > 1)
            .map(([text, count]) => ({ text, count })),
          sectionsInMain: mainSections.length,
          largeGaps,
          imageCount: images.length,
          failedImages: images.filter((image) => image.complete && image.naturalWidth === 0).length,
          placeholders: document.querySelectorAll("[data-image-placeholder]").length,
          emptyHeadingsRendered: Array.from(document.querySelectorAll("main h1,main h2,main h3"))
            .filter((heading) =>
              /no published|not available yet|no items in this category/i.test(
                heading.textContent ?? ""
              )
            )
            .map((heading) => heading.textContent?.trim()),
        };
      });

      await page.screenshot({ path: path.join(outputDir, `${base}-top.png`) });
      await page.screenshot({ path: path.join(outputDir, `${base}-full.png`), fullPage: true });

      const scrollHeight = await page.locator("body").evaluate((element) => element.scrollHeight);
      const steps = Math.ceil(scrollHeight / viewport.height);
      for (let step = 1; step < steps; step += 1) {
        await page.evaluate((y) => window.scrollTo(0, y), step * viewport.height);
        await page.waitForTimeout(180);
        await page.screenshot({
          path: path.join(outputDir, `${base}-scroll-${String(step).padStart(2, "0")}.png`),
        });
      }
      pageMetrics.push({
        route: route.path,
        viewport: viewport.name,
        status: response?.status() ?? null,
        scrollHeight,
        screens: Number((scrollHeight / viewport.height).toFixed(2)),
        ...pageMeasurement,
        screenshots: [
          `${base}-top.png`,
          `${base}-full.png`,
          ...Array.from(
            { length: Math.max(0, steps - 1) },
            (_, index) => `${base}-scroll-${String(index + 1).padStart(2, "0")}.png`
          ),
        ],
        pageErrors: [...errors],
      });
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    if (viewport.name === "desktop") {
      await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(outputDir, "home-header-top.png") });

      // Check header background and sticky behavior
      const headerClasses = await page.locator("[data-public-site-header]").getAttribute("class");
      report.push({ check: "header-cream-navbar", isCream: headerClasses?.includes("bg-cream-50") ?? false });

      // Scroll down past hero to check header transition
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(250);
      const headerScrolledAttr = await page.locator("[data-public-site-header]").getAttribute("data-scrolled");
      report.push({ check: "header-shadow-on-scroll", scrolled: headerScrolledAttr === "true" });
      await page.screenshot({ path: path.join(outputDir, "home-header-scrolled.png") });

      // Check sheets overlap styling
      const sheetsOverlap = await page.evaluate(() => {
        const stays = document.getElementById("stays");
        const activities = document.getElementById("activities");
        const food = document.getElementById("food");
        const location = document.getElementById("location");
        const closing = document.getElementById("closing-cta");
        return {
          staysRounded: Boolean(stays?.classList.contains("rounded-t-[2.5rem]") || stays?.classList.contains("rounded-t-[3.5rem]")),
          activitiesRounded: Boolean(activities?.classList.contains("rounded-t-[2.5rem]") || activities?.classList.contains("rounded-t-[3.5rem]")),
          foodRounded: Boolean(food?.classList.contains("rounded-t-[2.5rem]") || food?.classList.contains("rounded-t-[3.5rem]")),
          locationRounded: Boolean(location?.classList.contains("rounded-t-[2.5rem]") || location?.classList.contains("rounded-t-[3.5rem]")),
          closingRounded: Boolean(closing?.classList.contains("rounded-t-[2.5rem]") || closing?.classList.contains("rounded-t-[3.5rem]")),
        };
      });
      report.push({ check: "sheets-overlap", ...sheetsOverlap });

      // Check parallax drift elements
      const driftElements = page.locator("[data-parallax-drift]");
      const driftCount = await driftElements.count();
      if (driftCount > 0) {
        const initialTransform = await driftElements.first().evaluate((el) => getComputedStyle(el).transform);
        await page.evaluate(() => window.scrollTo(0, 200));
        await page.waitForTimeout(150);
        const scrolledTransform = await driftElements.first().evaluate((el) => getComputedStyle(el).transform);
        const driftRate = await driftElements.first().getAttribute("data-parallax-drift");
        report.push({
          check: "hero-parallax-drift",
          driftCount,
          driftRate,
          stableDiffRate: driftRate !== "1",
          moved: initialTransform !== scrolledTransform,
        });
      }

      // Check Food Explorer Combinations
      const foodSection = page.locator("#food");
      if (await foodSection.count()) {
        await foodSection.scrollIntoViewIfNeeded();
        const mealTabs = ["Breakfast", "Lunch & dinner", "Evening tea"];
        const foodCombinations: Record<string, unknown>[] = [];

        for (const tabName of mealTabs) {
          const tab = page.getByRole("tab", { name: tabName });
          if (await tab.count()) {
            await tab.click();
            await page.waitForTimeout(150);

            // Veg preference
            const vegRadio = page.getByRole("radio", { name: "Veg" });
            if (await vegRadio.count()) {
              await vegRadio.click();
              await page.waitForTimeout(100);
              const vegChipCount = await page.locator("#panel-food button, [id^=panel-] button").count();
              foodCombinations.push({ meal: tabName, pref: "veg", chips: vegChipCount });
            }

            // Non-veg preference
            const nonVegRadio = page.getByRole("radio", { name: "Non-veg" });
            if (await nonVegRadio.count()) {
              await nonVegRadio.click();
              await page.waitForTimeout(100);
              const nonVegChipCount = await page.locator("#panel-food button, [id^=panel-] button").count();
              foodCombinations.push({ meal: tabName, pref: "non-veg", chips: nonVegChipCount });
            }
          }
        }
        report.push({ check: "food-explorer-combinations", combinations: foodCombinations });
      }

      // Check Click-to-load Google Maps
      const mapSection = page.locator("#find-us");
      if (await mapSection.count()) {
        await mapSection.scrollIntoViewIfNeeded();
        const iframeBefore = await mapSection.locator("iframe").count();
        const loadMapBtn = page.getByRole("button", { name: "Load interactive map" });
        let iframeAfter = 0;
        if (await loadMapBtn.count()) {
          await loadMapBtn.click();
          await page.waitForTimeout(300);
          iframeAfter = await mapSection.locator("iframe").count();
        }
        report.push({
          check: "map-click-to-load",
          iframeBeforeClick: iframeBefore,
          iframeAfterClick: iframeAfter,
          loadedOnlyAfterClick: iframeBefore === 0 && iframeAfter === 1,
        });
      }

      // Section Dots navigation check
      const sectionDots = page.locator("nav[aria-label='Page sections navigation'] a");
      const dotCount = await sectionDots.count();
      report.push({ check: "desktop-section-dots", count: dotCount, hasDots: dotCount > 0 });

      // Stay card hover check
      const card = page.locator("article.stay-card-reveal").first();
      if (await card.count()) {
        await card.scrollIntoViewIfNeeded();
        const before = await card.evaluate((element) => getComputedStyle(element).transform);
        await card.hover();
        await page.waitForTimeout(250);
        const after = await card.evaluate((element) => getComputedStyle(element).transform);
        report.push({ check: "stay-card-hover", before, after, changed: before !== after });
        await page.screenshot({ path: path.join(outputDir, "home-card-hover.png") });
      }

      // Parallax Scene check
      const scene = page.locator("[data-parallax-layer]").first();
      if (await scene.count()) {
        const start = await scene.evaluate((element) => getComputedStyle(element).transform);
        await page.evaluate(() => window.scrollBy(0, 100));
        await page.waitForTimeout(100);
        const end = await scene.evaluate((element) => getComputedStyle(element).transform);
        report.push({
          check: "parallax",
          start,
          end,
          rate: await scene.evaluate((element) => element.getAttribute("data-parallax-rate")),
          changed: start !== end,
        });
      }
    } else {
      // Mobile audit
      await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
      await page.screenshot({ path: path.join(outputDir, "home-mobile-scroll-top.png") });

      const openMenu = page.getByRole("button", { name: "Open navigation menu" });
      if (await openMenu.count()) {
        await openMenu.click();
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(outputDir, "home-mobile-menu-open.png") });
      }

      // Horizontal overflow checks across responsive viewports
      for (const route of routes) {
        for (const width of overflowWidths) {
          await page.setViewportSize({ width, height: viewport.height });
          await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: "domcontentloaded" });
          const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          report.push({
            check: "horizontal-overflow",
            route: route.path,
            width,
            document: documentWidth,
            viewport: width,
            passed: documentWidth <= width,
          });
        }
      }

      // Reduced motion check
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
      const hiddenReveal = page.locator("[data-reveal-state=hidden]").count();
      report.push({
        check: "reduced-motion",
        hiddenRevealCount: await hiddenReveal,
        parallaxSceneCount: await page.locator("[data-parallax-scene]").count(),
      });
    }

    report.push({ check: "page-errors", viewport: viewport.name, errors: [...errors] });
    await page.close();
    await context.close();
  }

  await browser.close();
  await writeFile(
    path.join(outputDir, "motion-verification.json"),
    JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), results: report }, null, 2)
  );
  await writeFile(
    path.join(outputDir, "metrics.json"),
    JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), pages: pageMetrics }, null, 2)
  );
  console.log(`Saved browser evidence and measurements under ${outputDir}`);
}

void main();
