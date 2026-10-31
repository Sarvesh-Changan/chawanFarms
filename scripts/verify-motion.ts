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
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of routes) {
    const response = await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const base = `${route.name}-${viewport.name}`;
    const pageMeasurement = await page.evaluate(() => {
      const main = document.querySelector("main");
      const headingValues = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"), (heading) => heading.textContent?.trim().replace(/\s+/g, " ") ?? "").filter(Boolean);
      const headingCounts = new Map<string, number>();
      headingValues.forEach((heading) => headingCounts.set(heading, (headingCounts.get(heading) ?? 0) + 1));
      const paragraphs = Array.from(document.querySelectorAll("p"), (paragraph) => paragraph.textContent?.trim().replace(/\s+/g, " ") ?? "").filter((paragraph) => paragraph.length > 30);
      const paragraphCounts = new Map<string, number>();
      paragraphs.forEach((paragraph) => paragraphCounts.set(paragraph, (paragraphCounts.get(paragraph) ?? 0) + 1));
      const mainSections = main ? Array.from(main.querySelectorAll("section")).filter((section) => !section.parentElement?.closest("section")) : [];
      const sectionRects = mainSections.map((section) => section.getBoundingClientRect()).sort((a, b) => a.top - b.top);
      const largeGaps: Array<{ pixels: number; screens: number }> = [];
      let previousSection: DOMRect | undefined;
      for (const rect of sectionRects) {
        if (previousSection) {
          const gap = rect.top - previousSection.bottom;
          if (gap > window.innerHeight * 0.75) {
            largeGaps.push({ pixels: Math.round(gap), screens: Number((gap / window.innerHeight).toFixed(2)) });
          }
        }
        previousSection = rect;
      }
      const images = Array.from(document.images);
      return {
        h1Count: document.querySelectorAll("h1").length,
        emptyHeadings: Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((heading) => !heading.textContent?.trim()).length,
        duplicateHeadings: Array.from(headingCounts).filter(([, count]) => count > 1).map(([heading, count]) => ({ heading, count })),
        duplicateParagraphs: Array.from(paragraphCounts).filter(([, count]) => count > 1).map(([text, count]) => ({ text, count })),
        sectionsInMain: mainSections.length,
        largeGaps,
        imageCount: images.length,
        failedImages: images.filter((image) => image.complete && image.naturalWidth === 0).length,
        placeholders: document.querySelectorAll("[data-image-placeholder]").length,
        emptyHeadingsRendered: Array.from(document.querySelectorAll("main h1,main h2,main h3")).filter((heading) => /no published|not available yet|no items in this category/i.test(heading.textContent ?? "")).map((heading) => heading.textContent?.trim()),
      };
    });
    await page.screenshot({ path: path.join(outputDir, `${base}-top.png`) });
    await page.screenshot({ path: path.join(outputDir, `${base}-full.png`), fullPage: true });
    const scrollHeight = await page.locator("body").evaluate((element) => element.scrollHeight);
    const steps = Math.ceil(scrollHeight / viewport.height);
    for (let step = 1; step < steps; step += 1) {
      await page.evaluate((y) => window.scrollTo(0, y), step * viewport.height);
      await page.waitForTimeout(180);
      await page.screenshot({ path: path.join(outputDir, `${base}-scroll-${String(step).padStart(2, "0")}.png`) });
    }
    pageMetrics.push({ route: route.path, viewport: viewport.name, status: response?.status() ?? null, scrollHeight, screens: Number((scrollHeight / viewport.height).toFixed(2)), ...pageMeasurement, screenshots: [`${base}-top.png`, `${base}-full.png`, ...Array.from({ length: Math.max(0, steps - 1) }, (_, index) => `${base}-scroll-${String(index + 1).padStart(2, "0")}.png`)], pageErrors: [...errors] });
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  if (viewport.name === "desktop") {
    await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(outputDir, "home-header-top.png") });
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outputDir, "home-header-scrolled.png") });
    await page.evaluate(() => window.scrollBy(0, -160));
    await page.screenshot({ path: path.join(outputDir, "home-header-scroll-up.png") });
    const dropdown = page.getByRole("button", { name: /stays/i }).first();
    if (await dropdown.count()) {
      await dropdown.hover();
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(outputDir, "home-dropdown-open.png") });
    }
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
    const reveal = page.locator("[data-reveal-state]").first();
    if (await reveal.count()) {
      const initial = await reveal.getAttribute("data-reveal-state");
      await reveal.scrollIntoViewIfNeeded();
      await page.waitForTimeout(650);
      report.push({ check: "reveal", initial, final: await reveal.getAttribute("data-reveal-state") });
    }
    const scene = page.locator("[data-parallax-layer]").first();
    if (await scene.count()) {
      const start = await scene.evaluate((element) => getComputedStyle(element).transform);
      await page.evaluate(() => window.scrollBy(0, 100));
      await page.waitForTimeout(100);
      const end = await scene.evaluate((element) => getComputedStyle(element).transform);
      report.push({ check: "parallax", start, end, rate: await scene.evaluate((element) => element.getAttribute("data-parallax-rate")), changed: start !== end });
    } else report.push({ check: "parallax", result: "no eligible scene rendered" });
    const slider = page.locator("[aria-roledescription=carousel]").first();
    if (await slider.count()) {
      report.push({ check: "slider", scrollSnapType: await slider.evaluate((element) => getComputedStyle(element).scrollSnapType), autoplayAttributes: await slider.evaluate((element) => [...element.attributes].filter((attribute) => /auto.?play/i.test(attribute.name)).map((attribute) => attribute.name)) });
    } else report.push({ check: "slider", result: "no eligible slider rendered" });
  } else {
    await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outputDir, "home-mobile-scroll-top.png") });
    const openMenu = page.getByRole("button", { name: "Open navigation menu" });
    if (await openMenu.count()) {
      await openMenu.click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(outputDir, "home-mobile-menu-open.png") });
    }
    for (const route of routes) {
      for (const width of overflowWidths) {
        await page.setViewportSize({ width, height: viewport.height });
        await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: "domcontentloaded" });
        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        report.push({ check: "horizontal-overflow", route: route.path, width, document: documentWidth, viewport: width, passed: documentWidth <= width });
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
    const hiddenReveal = page.locator("[data-reveal-state=hidden]").count();
    report.push({ check: "reduced-motion", hiddenRevealCount: await hiddenReveal, parallaxSceneCount: await page.locator("[data-parallax-scene]").count() });
  }
  report.push({ check: "page-errors", viewport: viewport.name, errors: [...errors] });
  await page.close();
  await context.close();
  const videoContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    reducedMotion: "no-preference",
    recordVideo: { dir: outputDir, size: { width: viewport.width, height: viewport.height } },
  });
  const videoPage = await videoContext.newPage();
  await videoPage.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
  await videoPage.evaluate(async () => {
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    for (let y = 0; y <= maxY; y += 32) {
      window.scrollTo(0, y);
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    window.scrollTo(0, 0);
  });
  const video = videoPage.video();
  await videoPage.close();
  await videoContext.close();
  if (video) await video.saveAs(path.join(outputDir, `home-slow-scroll-${viewport.name}.webm`));
  await context.close();
}

await browser.close();
await writeFile(path.join(outputDir, "motion-verification.json"), JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), results: report }, null, 2));
await writeFile(path.join(outputDir, "metrics.json"), JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), pages: pageMetrics }, null, 2));
console.log(`Saved browser evidence and measurements under ${outputDir}`);
}

void main();
