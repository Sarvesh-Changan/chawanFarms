import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Locator, type Page } from "@playwright/test";

/* The study intentionally writes computed, generated artifacts to dynamic paths. */
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection */

const BASE_URL = "https://archigreendesigns.com/";
const ROOT = path.resolve("docs/reference/archigreen");
const PAUSE_MS = 1_500;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
] as const;

type ViewportName = (typeof VIEWPORTS)[number]["name"];
type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const failures: string[] = [];
const captureSummary: Record<string, unknown> = {
  baseUrl: BASE_URL,
  startedAt: new Date().toISOString(),
  pages: [],
  failures,
};

async function ensureDir(directory: string) {
  await mkdir(directory, { recursive: true });
}

async function writeJson(fileName: string, value: JsonValue) {
  await writeFile(path.join(ROOT, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(fileName: string, value: string) {
  await writeFile(path.join(ROOT, fileName), value, "utf8");
}

async function safeScreenshot(target: Page | Locator, fileName: string, fullPage = false) {
  try {
    await target.screenshot({ path: fileName, fullPage, timeout: 15_000 });
  } catch (error) {
    failures.push(`Screenshot failed (${fileName}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function safeElementScreenshot(page: Page, target: Locator, fileName: string) {
  try {
    const marker = await target.getAttribute("data-reference-section");
    if (!marker) throw new Error("section marker missing");
    const selector = `[data-reference-section='${marker}']`;
    await page.evaluate((value) => document.querySelector(value)?.scrollIntoView({ block: "center", behavior: "instant" }), selector);
    await page.waitForTimeout(700);
    const box = await page.locator(selector).boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) throw new Error("element has no visible bounding box");
    await page.screenshot({ path: fileName, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, 4_000), height: Math.min(box.height, 4_000) }, timeout: 15_000 });
  } catch (error) {
    failures.push(`Element screenshot failed (${fileName}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function settle(page: Page, pause = PAUSE_MS) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  } catch {
    failures.push(`Network idle timeout at ${page.url()}; continuing after DOM readiness.`);
  }
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(pause);
}

function slug(value: string) {
  return value.replace(/^https?:\/\/[^/]+/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "home";
}

function sameOrigin(url: string) {
  try {
    return new URL(url).origin === new URL(BASE_URL).origin;
  } catch {
    return false;
  }
}

function robotsAllows(robotsText: string, pathname: string) {
  const rules: string[] = [];
  let applies = false;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      applies = value === "*";
      continue;
    }
    if (applies && key === "disallow" && value) rules.push(value);
  }
  const matching = rules.filter((rule) => pathname.startsWith(rule));
  return matching.sort((a, b) => b.length - a.length)[0] !== "/";
}

async function checkRobots(browser: Browser) {
  const context = await browser.newContext({ userAgent: "ChawanFarmsReferenceStudy/1.0 (polite design research)" });
  const page = await context.newPage();
  try {
    const response = await page.goto(new URL("robots.txt", BASE_URL).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
    if (!response || !response.ok()) throw new Error(`robots.txt returned ${response?.status() ?? "no response"}`);
    const text = await page.locator("body").innerText();
    await context.close();
    return text;
  } catch (error) {
    await context.close();
    throw new Error(`Could not reach ${new URL("robots.txt", BASE_URL)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function discoverPages(page: Page, robotsText: string) {
  const links = await page.locator("header a[href], footer a[href]").evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
  const seen = new Set<string>();
  const discovered: string[] = [];
  for (const href of links) {
    if (!sameOrigin(href)) continue;
    const url = new URL(href);
    url.hash = "";
    if (url.pathname === "/" || seen.has(url.toString())) continue;
    if (!robotsAllows(robotsText, url.pathname)) {
      failures.push(`Skipped robots-disallowed linked path: ${url.pathname}`);
      continue;
    }
    seen.add(url.toString());
    discovered.push(url.toString());
    if (discovered.length === 5) break;
  }
  return discovered;
}

async function scrollScreenshots(page: Page, viewport: (typeof VIEWPORTS)[number]) {
  const output = path.join(ROOT, viewport.name);
  await ensureDir(output);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await safeScreenshot(page, path.join(output, "full.png"), true);
  const scrollHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  const step = viewport.height;
  let index = 1;
  for (let y = 0; y < scrollHeight; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(250);
    await safeScreenshot(page, path.join(output, `viewport-${String(index).padStart(3, "0")}.png`));
    index += 1;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function recordScrollVideo(browser: Browser, viewport: (typeof VIEWPORTS)[number]) {
  const videoDir = path.join(ROOT, viewport.name);
  await ensureDir(videoDir);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    recordVideo: { dir: videoDir, size: { width: viewport.width, height: viewport.height } },
  });
  const page = await context.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);
    const height = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let y = 0; y <= height; y += Math.max(100, Math.floor(viewport.height / 3))) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(500);
  } catch (error) {
    failures.push(`Video capture failed (${viewport.name}): ${error instanceof Error ? error.message : String(error)}`);
  }
  const video = page.video();
  const videoPath = video ? await video.path() : null;
  await page.close();
  await context.close();
  if (videoPath) {
    const target = path.join(videoDir, `scroll-${viewport.name}.webm`);
    try {
      if (!(await stat(target).catch(() => null))) await rename(videoPath, target);
    } catch (error) {
      failures.push(`Could not place ${target}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function linkedPageScreenshots(browser: Browser, urls: string[], viewport: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
  const page = await context.newPage();
  for (const [index, url] of urls.entries()) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settle(page);
      await safeScreenshot(page, path.join(ROOT, viewport.name, "pages", `${String(index + 1).padStart(2, "0")}-${slug(url)}.png`), true);
      (captureSummary.pages as unknown[]).push({ viewport: viewport.name, url, status: "captured" });
    } catch (error) {
      failures.push(`Linked page failed (${url}): ${error instanceof Error ? error.message : String(error)}`);
      (captureSummary.pages as unknown[]).push({ viewport: viewport.name, url, status: "failed" });
    }
    await page.waitForTimeout(PAUSE_MS);
  }
  await context.close();
}

async function sectionLocator(page: Page, label: string, fallbackIndex: number) {
  const candidates = page.locator("main section, main article, header, footer");
  const count = await candidates.count();
  const marker = `reference-section-${fallbackIndex}`;
  const found = await page.evaluate(({ label, marker }) => {
    const elements = Array.from(document.querySelectorAll("main section, main article, header, footer"));
    const element = elements.find((candidate) => {
      if (!(candidate.textContent ?? "").toLowerCase().includes(label.toLowerCase())) return false;
      const computed = getComputedStyle(candidate);
      const box = candidate.getBoundingClientRect();
      return computed.display !== "none" && computed.visibility !== "hidden" && box.width > 0 && box.height > 0;
    });
    if (!element) return false;
    element.setAttribute("data-reference-section", marker);
    return true;
  }, { label, marker });
  if (found) return page.locator(`[data-reference-section='${marker}']`);
  return count ? candidates.nth(Math.min(fallbackIndex, count - 1)) : null;
}

async function sectionScreenshots(page: Page, viewport: ViewportName) {
  const output = path.join(ROOT, viewport, "sections");
  await ensureDir(output);
  const targets = [
    ["header", "AGDS", 0],
    ["hero", "Archi Green Design Studio", 1],
    ["stats", "Projects Developed", 2],
    ["services", "Our Services", 3],
    ["feature", "Smart. Precise. Immersive.", 4],
    ["spotlight", "Healthcare", 5],
    ["projects", "Our Projects", 6],
    ["testimonials", "Testimonials", 7],
    ["closing-statement", "Designing with purpose", 8],
    ["footer", "All Rights Reserved", 9],
  ] as const;
  for (const [name, label, fallback] of targets) {
    const locator = await sectionLocator(page, label, fallback);
    if (locator) await safeElementScreenshot(page, locator, path.join(output, `${name}.png`));
  }
}

async function interactionScreenshots(page: Page, viewport: ViewportName) {
  const output = path.join(ROOT, viewport, "interactions");
  await ensureDir(output);
  const candidates: Array<[string, Locator]> = [
    ["nav-link", page.locator("header a").first()],
    ["button", page.locator("button, a[role='button']").first()],
    ["card", page.locator("main article, main [class*='card'], main figure").first()],
    ["image", page.locator("main img").first()],
  ];
  for (const [name, locator] of candidates) {
    if (!(await locator.count()) || !(await locator.isVisible().catch(() => false))) continue;
    await safeScreenshot(locator, path.join(output, `${name}-before.png`));
    await locator.hover().catch(() => undefined);
    await page.waitForTimeout(300);
    await safeScreenshot(locator, path.join(output, `${name}-hover.png`));
    await locator.focus().catch(() => undefined);
    await page.waitForTimeout(150);
    await safeScreenshot(locator, path.join(output, `${name}-focus.png`));
  }

  const menu = page.locator("button[aria-label*='menu' i], button[title*='menu' i], button:has-text('Menu')").first();
  if ((await menu.count()) && (await menu.isVisible().catch(() => false))) {
    await safeScreenshot(page, path.join(output, "mobile-menu-closed.png"));
    await menu.click().catch(() => undefined);
    await page.waitForTimeout(300);
    await safeScreenshot(page, path.join(output, "mobile-menu-open.png"));
    await menu.click().catch(() => undefined);
  }

  const slider = page.locator("[class*='swiper' i], [class*='slider' i], [class*='carousel' i], [data-testid*='slider' i]").first();
  if ((await slider.count()) && (await slider.isVisible().catch(() => false))) {
    await slider.scrollIntoViewIfNeeded();
    await safeScreenshot(slider, path.join(output, "slider-before.png"));
    const box = await slider.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForTimeout(400);
    await safeScreenshot(slider, path.join(output, "slider-after-drag.png"));
    const next = page.getByRole("button", { name: /next|forward|right/i }).first();
    if ((await next.count()) && (await next.isVisible().catch(() => false))) {
      await next.click().catch(() => undefined);
      await page.waitForTimeout(400);
      await safeScreenshot(slider, path.join(output, "slider-after-next.png"));
    }
  }
}

async function collectTokens(page: Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const cssVariables: Record<string, string> = {};
    for (const property of Array.from(document.styleSheets).flatMap((sheet) => {
      try { return Array.from(sheet.cssRules); } catch { return []; }
    })) {
      if (property instanceof CSSStyleRule && property.selectorText === ":root") {
        for (const name of Array.from(property.style)) if (name.startsWith("--")) cssVariables[name] = property.style.getPropertyValue(name).trim();
      }
    }
    const representative: Record<string, Record<string, string> | null> = {};
    for (const [name, selector] of Object.entries({ body: "body", header: "header", footer: "footer", h1: "h1", h2: "h2", h3: "h3", h4: "h4", bodyText: "p", label: "label", button: "button, a[role='button']", link: "a", input: "input" })) {
      const element = document.querySelector(selector);
      if (!element) { representative[name] = null; continue; }
      const computed = getComputedStyle(element) as CSSStyleDeclaration & { animationTimeline?: string };
      representative[name] = { selector: element.tagName.toLowerCase(), fontFamily: computed.fontFamily, fontSize: computed.fontSize, fontWeight: computed.fontWeight, lineHeight: computed.lineHeight, letterSpacing: computed.letterSpacing, color: computed.color, backgroundColor: computed.backgroundColor, borderColor: computed.borderColor, borderRadius: computed.borderRadius, boxShadow: computed.boxShadow };
    }
    const colours = new Map<string, { count: number; uses: string[] }>();
    for (const element of Array.from(document.querySelectorAll("body *")).slice(0, 1500)) {
      const computed = getComputedStyle(element) as CSSStyleDeclaration & { animationTimeline?: string };
      for (const [kind, value] of [["color", computed.color], ["background", computed.backgroundColor], ["border", computed.borderColor], ["shadow", computed.boxShadow]] as const) {
        if (!value || value === "rgba(0, 0, 0, 0)" || value === "none") continue;
        const key = `${kind}:${value}`;
        const item = colours.get(key) ?? { count: 0, uses: [] };
        item.count += 1;
        if (item.uses.length < 4) item.uses.push(element.tagName.toLowerCase());
        colours.set(key, item);
      }
    }
    const layout = Array.from(document.querySelectorAll("main, section, header, footer, [class*='grid' i], [class*='flex' i]")).slice(0, 300).map((element) => {
      const computed = getComputedStyle(element);
      return { tag: element.tagName.toLowerCase(), className: typeof element.className === "string" ? element.className.slice(0, 160) : "", maxWidth: computed.maxWidth, padding: computed.padding, gap: computed.gap, columnGap: computed.columnGap, rowGap: computed.rowGap, borderRadius: computed.borderRadius, boxShadow: computed.boxShadow };
    });
    return { viewport: { width: innerWidth, height: innerHeight }, rootComputed: { fontFamily: root.fontFamily, fontSize: root.fontSize }, cssVariables, representative, colours: Object.fromEntries(colours), layout };
  });
}

async function collectMotion(page: Page) {
  return page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("body *")).map((element) => {
      const computed = getComputedStyle(element) as CSSStyleDeclaration & { animationTimeline?: string };
      if (computed.transitionProperty === "all" || computed.transitionProperty !== "none" || computed.animationName !== "none" || computed.willChange !== "auto" || computed.transform !== "none" || computed.scrollSnapType !== "none") {
        return { tag: element.tagName.toLowerCase(), className: typeof element.className === "string" ? element.className.slice(0, 180) : "", transition: `${computed.transitionProperty} ${computed.transitionDuration} ${computed.transitionDelay} ${computed.transitionTimingFunction}`, animation: `${computed.animationName} ${computed.animationDuration} ${computed.animationDelay} ${computed.animationTimingFunction}`, willChange: computed.willChange, transform: computed.transform, scrollSnapType: computed.scrollSnapType, animationTimeline: computed.animationTimeline };
      }
      return null;
    }).filter(Boolean).slice(0, 500);
    const keyframes: Array<{ name: string; cssText: string }> = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) if (rule instanceof CSSKeyframesRule) keyframes.push({ name: rule.name, cssText: rule.cssText });
      } catch { /* cross-origin stylesheet rules are not readable */ }
    }
    return { elements, keyframes };
  });
}

async function collectParallax(page: Page) {
  const selectors = await page.evaluate(() => Array.from(document.querySelectorAll("header, main section, main img, footer")).slice(0, 24).map((element, index) => {
    element.setAttribute("data-reference-study-index", String(index));
    return `[data-reference-study-index='${index}']`;
  }));
  const height = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  const steps = Array.from({ length: Math.min(10, Math.ceil(height / 160) + 1) }, (_, index) => index * 160).filter((value, index, values) => value >= 0 && values.indexOf(value) === index);
  const samples: Record<string, Array<{ scrollY: number; top: number; left: number; height: number }>> = {};
  for (const selector of selectors) {
    samples[selector] = [];
    for (const scrollY of steps) {
      await page.evaluate((top) => window.scrollTo(0, top), scrollY);
      await page.waitForTimeout(100);
      const box = await page.locator(selector).boundingBox().catch(() => null);
      if (box) samples[selector].push({ scrollY, top: box.y, left: box.x, height: box.height });
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  const rates = Object.fromEntries(Object.entries(samples).map(([selector, values]) => {
    const first = values[0];
    const last = values.at(-1);
    const scrollDelta = last && first ? last.scrollY - first.scrollY : 0;
    const movement = last && first ? last.top - first.top : 0;
    return [selector, { movementRate: scrollDelta ? Number((-movement / scrollDelta).toFixed(3)) : null, direction: movement > 0 ? "down" : movement < 0 ? "up" : "static", range: first && last ? { firstTop: first.top, lastTop: last.top } : null, samples: values }];
  }));
  return { stepSize: 160, samples: rates };
}

async function collectReveals(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page.evaluate(() => Array.from(document.querySelectorAll("main section, main article, main h2, main h3")).slice(0, 80).map((element, index) => {
    element.setAttribute("data-reference-reveal-index", String(index));
    const computed = getComputedStyle(element);
    return { selector: `[data-reference-reveal-index='${index}']`, className: element.className, opacity: computed.opacity, transform: computed.transform, top: element.getBoundingClientRect().top };
  }));
  const height = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  for (let y = 0; y <= height; y += 180) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  const after = await page.evaluate(() => Array.from(document.querySelectorAll("[data-reference-reveal-index]")).map((element) => {
    const computed = getComputedStyle(element);
    return { selector: element.getAttribute("data-reference-reveal-index"), className: element.className, opacity: computed.opacity, transform: computed.transform, top: element.getBoundingClientRect().top };
  }));
  await page.evaluate(() => window.scrollTo(0, 0));
  return { before, after, changed: after.filter((item, index) => JSON.stringify(item) !== JSON.stringify(before[index])) };
}

async function collectCounters(page: Page) {
  const selectors = await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter((element) => /^\s*\d[\d,.+ ]*\s*[%+MmKk]?$/.test(element.textContent ?? "") && element.children.length === 0).slice(0, 20).map((element, index) => {
    element.setAttribute("data-reference-counter-index", String(index));
    return `[data-reference-counter-index='${index}']`;
  }));
  const counters: Record<string, { samples: Array<{ atMs: number; text: string }>; start: string; end: string }> = {};
  for (const selector of selectors) {
    const locator = page.locator(selector);
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    const samples: Array<{ atMs: number; text: string }> = [];
    const start = Date.now();
    while (Date.now() - start < 3_000) {
      samples.push({ atMs: Date.now() - start, text: (await locator.textContent().catch(() => ""))?.trim() ?? "" });
      await page.waitForTimeout(250);
    }
    counters[selector] = { samples, start: samples[0]?.text ?? "", end: samples.at(-1)?.text ?? "" };
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return counters;
}

async function collectSliders(page: Page) {
  return page.evaluate(() => {
    const selectors = ["[class*='swiper' i]", "[class*='slick' i]", "[class*='splide' i]", "[class*='carousel' i]", "[class*='slider' i]", "[data-testid*='slider' i]"];
    return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).slice(0, 12).map((element) => {
      const computed = getComputedStyle(element);
      const children = Array.from(element.children);
      return { selector, className: typeof element.className === "string" ? element.className : "", childCount: children.length, visibleChildren: children.filter((child) => { const box = child.getBoundingClientRect(); return box.width > 0 && box.height > 0; }).length, scrollWidth: (element as HTMLElement).scrollWidth, clientWidth: (element as HTMLElement).clientWidth, scrollSnapType: computed.scrollSnapType, scrollSnapAlign: computed.scrollSnapAlign, overflowX: computed.overflowX, autoplayAttributes: { autoplay: element.getAttribute("autoplay"), dataAutoplay: element.getAttribute("data-autoplay") } };
    }));
  });
}

async function collectLibraries(page: Page) {
  return page.evaluate(() => {
    const scriptNames = Array.from(document.scripts).map((script) => script.src ? new URL(script.src, location.href).pathname.split("/").at(-1) : "inline");
    const classHints = Array.from(document.querySelectorAll("[class]"), (element) => typeof element.className === "string" ? element.className : "").filter((value) => /swiper|slick|splide|elementor|gsap|lenis|locomotive|jquery|motion/i.test(value)).slice(0, 100);
    const globals = Object.keys(window).filter((key) => /swiper|slick|splide|elementor|gsap|jquery|lenis|locomotive|motion/i.test(key));
    return { scriptNames, classHints, globals };
  });
}

async function main() {
  await ensureDir(ROOT);
  const browser = await chromium.launch({ headless: true });
  try {
    const robotsText = await checkRobots(browser);
    await writeText("robots.txt", robotsText);
    if (!robotsAllows(robotsText, "/")) throw new Error("robots.txt disallows the home page for User-agent *.");

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);
    const linkedUrls = await discoverPages(page, robotsText);
    (captureSummary as Record<string, unknown>).linkedPages = linkedUrls;
    for (const viewport of VIEWPORTS) {
      const viewportContext = viewport.name === "desktop" ? context : await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
      const viewportPage = viewport.name === "desktop" ? page : await viewportContext.newPage();
      if (viewport.name === "mobile") {
        await viewportPage.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await settle(viewportPage);
      }
      await scrollScreenshots(viewportPage, viewport);
      await sectionScreenshots(viewportPage, viewport.name);
      await interactionScreenshots(viewportPage, viewport.name);
      console.log(`collect tokens (${viewport.name})`);
      await writeJson(`tokens-${viewport.name}.json`, await collectTokens(viewportPage));
      console.log(`collect motion (${viewport.name})`);
      await writeJson(`motion-${viewport.name}.json`, await collectMotion(viewportPage));
      console.log(`collect parallax (${viewport.name})`);
      await writeJson(`parallax-${viewport.name}.json`, await collectParallax(viewportPage));
      console.log(`collect reveals (${viewport.name})`);
      await writeJson(`reveal-${viewport.name}.json`, await collectReveals(viewportPage));
      console.log(`collect counters (${viewport.name})`);
      await writeJson(`counters-${viewport.name}.json`, await collectCounters(viewportPage));
      console.log(`collect sliders (${viewport.name})`);
      await writeJson(`sliders-${viewport.name}.json`, await collectSliders(viewportPage));
      console.log(`collect libraries (${viewport.name})`);
      await writeJson(`libraries-${viewport.name}.json`, await collectLibraries(viewportPage));
      if (viewport.name === "mobile") await viewportContext.close();
      await linkedPageScreenshots(browser, linkedUrls, viewport);
      await recordScrollVideo(browser, viewport);
    }
    await page.close();
    await context.close();
    await writeJson("tokens.json", { desktop: JSON.parse(await readFile(path.join(ROOT, "tokens-desktop.json"), "utf8")), mobile: JSON.parse(await readFile(path.join(ROOT, "tokens-mobile.json"), "utf8")) });
    await writeJson("motion.json", { desktop: JSON.parse(await readFile(path.join(ROOT, "motion-desktop.json"), "utf8")), mobile: JSON.parse(await readFile(path.join(ROOT, "motion-mobile.json"), "utf8")) });
    await writeJson("libraries.json", { desktop: JSON.parse(await readFile(path.join(ROOT, "libraries-desktop.json"), "utf8")), mobile: JSON.parse(await readFile(path.join(ROOT, "libraries-mobile.json"), "utf8")) });
    const report = `# Archi Green reference study\n\n- Captured: ${new Date().toISOString()}\n- URL: ${BASE_URL}\n- Viewports: 1440×900 desktop and 390×844 mobile/touch\n- Browser: Chromium via Playwright ${process.env.npm_package_devDependencies ? "(project dependency)" : "(local install)"}\n- Linked pages: ${linkedUrls.length ? linkedUrls.join(", ") : "none discovered"}\n- Asset policy: screenshots and scroll videos only; no reference images, fonts, videos, scripts, or CSS were downloaded or saved for reuse.\n\n## Failures and limits\n\n${failures.length ? failures.map((failure) => `- ${failure}`).join("\n") : "- None recorded."}\n\nThe JSON files contain computed styles, motion declarations, sampled scroll positions, reveal diffs, counters, slider hints, and DOM/script-library observations.\n`;
    await writeText("report.md", report);
    (captureSummary as Record<string, unknown>).finishedAt = new Date().toISOString();
    await writeJson("capture-summary.json", captureSummary);
  } finally {
    await browser.close();
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  failures.push(message);
  await ensureDir(ROOT);
  await writeText("report.md", `# Archi Green reference study\n\nCapture stopped before completion.\n\n## Failure\n\n${message}\n`);
  console.error(`Reference capture stopped: ${message}`);
  process.exitCode = 1;
});
