import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.UI_AUDIT_BASE_URL ?? "http://127.0.0.1:3103";
const OUTPUT = path.resolve("docs/qa/ui-audit");
const ROUTES = [
  ["home", "/"], ["packages", "/packages"], ["accommodation", "/accommodation"],
  ["activities", "/activities"], ["stories", "/stories"], ["gallery", "/gallery"],
  ["food", "/food"], ["faq", "/faqs"], ["rewards", "/rewards"],
  ["contact", "/contact"], ["book", "/book"], ["about", "/about"],
  ["login", "/login"], ["signup", "/signup"], ["account", "/account"],
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
];

await mkdir(OUTPUT, { recursive: true });
const report = { baseUrl: BASE_URL, capturedAt: new Date().toISOString(), note: "Runtime metrics only describe the rendered response; authenticate only with a DEV-only account.", pages: [], failures: [] };
const browser = await chromium.launch({ headless: true });

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(700);
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const rgb = (color) => {
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const channels = match[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);
      return channels.length === 3 ? channels.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) : null;
    };
    const luminance = (color) => { const c = rgb(color); return c ? 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] : null; };
    const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return x === null || y === null ? null : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const sections = [...document.querySelectorAll("main section, main > article, main > div[id]")].map((node) => {
      const rect = node.getBoundingClientRect();
      return { id: node.id || null, label: (node.querySelector("h1,h2,h3")?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120), top: Math.round(rect.top + scrollY), bottom: Math.round(rect.bottom + scrollY), height: Math.round(rect.height) };
    });
    const gaps = sections.slice(1).map((item, index) => ({ before: sections[index].label, after: item.label, px: Math.max(0, item.top - sections[index].bottom) }));
    const images = [...document.images].map((image) => ({ src: image.currentSrc, alt: image.alt, loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth }));
    const emptyMediaFrameCandidates = [...document.querySelectorAll("div[class*='aspect-']")].filter((node) => {
      const classes = typeof node.className === "string" ? node.className : "";
      const rect = node.getBoundingClientRect();
      return /(?:bg-clay-100|bg-paddy-300|bg-muted)/.test(classes) && !node.querySelector("img,video,picture,iframe") && rect.width >= 100 && rect.height >= 70;
    }).length;
    const textNodes = [...document.querySelectorAll("h1,h2,h3,p")].map((node) => (node.textContent || "").trim().replace(/\s+/g, " ")).filter(Boolean);
    const counts = new Map();
    for (const text of textNodes) counts.set(text, (counts.get(text) || 0) + 1);
    const duplicateText = [...counts].filter(([, count]) => count > 1).map(([text, count]) => ({ text: text.slice(0, 140), count }));
    const samples = [...document.querySelectorAll("h1,h2,h3,p,a,button")].slice(0, 60).flatMap((node) => {
      const style = getComputedStyle(node);
      const ratio = contrast(style.color, style.backgroundColor);
      return ratio === null ? [] : [{ text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100), ratio: Math.round(ratio * 100) / 100, fontSize: style.fontSize }];
    });
    const resources = performance.getEntriesByType("resource");
    const audit = window.__uiAudit ?? {};
    return {
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, screensTall: Math.round((document.documentElement.scrollHeight / innerHeight) * 100) / 100, horizontalOverflow: document.documentElement.scrollWidth > innerWidth },
      sections, sectionCount: sections.length, whitespaceGaps: gaps, largeGaps: gaps.filter((gap) => gap.px > 160),
      images, failedImageCount: images.filter((image) => !image.loaded).length, emptyMediaFrameCandidates,
      duplicateText, contrastSamples: samples, minSampledContrast: samples.length ? Math.min(...samples.map((item) => item.ratio)) : null,
      resources: { javascriptBytes: resources.filter((entry) => entry.name.includes("/_next/static/") && entry.name.endsWith(".js")).reduce((sum, entry) => sum + entry.transferSize, 0), imageBytes: resources.filter((entry) => entry.initiatorType === "img" || /image\/(webp|jpeg|png|avif)/.test(entry.name)).reduce((sum, entry) => sum + entry.transferSize, 0) },
      webVitals: { lcpMs: audit.lcp ?? null, cls: audit.cls ?? 0, maxEventDurationMs: audit.maxEventDuration ?? null, tbtApproxMs: audit.tbtApprox ?? 0 },
      motionElements: [...document.querySelectorAll("*")].filter((node) => { const style = getComputedStyle(node); return style.animationName !== "none" || style.transform !== "none" || style.transitionDuration !== "0s"; }).length,
      animationNames: [...new Set([...document.querySelectorAll("*")].map((node) => getComputedStyle(node).animationName).filter((name) => name !== "none"))],
      transitionDurations: [...new Set([...document.querySelectorAll("*")].map((node) => getComputedStyle(node).transitionDuration).filter((duration) => duration !== "0s"))],
    };
  });
}

try {
  let runtimeBlocked = false;
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
    await context.addInitScript(() => {
      window.__uiAudit = { cls: 0, tbtApprox: 0, maxEventDuration: 0, lcp: null };
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__uiAudit.lcp = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__uiAudit.cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__uiAudit.tbtApprox += Math.max(0, entry.duration - 50); }).observe({ type: "longtask", buffered: true }); } catch {}
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (entry.interactionId) window.__uiAudit.maxEventDuration = Math.max(window.__uiAudit.maxEventDuration, entry.duration); }).observe({ type: "event", buffered: true, durationThreshold: 16 }); } catch {}
    });
    const page = await context.newPage();
    let pageErrors = [];
    let failedRequests = [];
    let networkBytes = { total: 0, javascript: 0, images: 0 };
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });
    page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on("response", async (response) => {
      try {
        const bytes = Number(response.headers()["content-length"] || 0);
        const kind = response.request().resourceType();
        networkBytes.total += bytes;
        if (kind === "script") networkBytes.javascript += bytes;
        if (kind === "image") networkBytes.images += bytes;
      } catch {}
    });

    const routeQueue = [...ROUTES];
    const seenRoutes = new Set(routeQueue.map(([, route]) => route));
    for (let routeIndex = 0; routeIndex < routeQueue.length; routeIndex++) {
      const [name, route] = routeQueue[routeIndex];
      pageErrors = [];
      failedRequests = [];
      const record = { name, route, viewport: viewport.name, screenshots: [], pageErrors, failedRequests };
      try {
        networkBytes = { total: 0, javascript: 0, images: 0 };
        const response = await page.goto(new URL(route, BASE_URL).href, { waitUntil: "domcontentloaded", timeout: 20000 });
        await settle(page);
        record.status = response?.status() ?? null;
        record.redirectedUrl = page.url();
        record.networkContentLengthBytes = networkBytes;
        if (name === "home" && (record.status ?? 0) >= 500) {
          const blockerShot = `runtime-blocker-${viewport.name}.png`;
          await page.screenshot({ path: path.join(OUTPUT, blockerShot), fullPage: true }).catch(() => {});
          record.screenshots.push(blockerShot);
          record.error = `Home returned HTTP ${record.status}; database-backed page capture stopped for this viewport.`;
          runtimeBlocked = true;
          report.failures.push(record.error);
          report.pages.push(record);
          await writeFile(path.join(OUTPUT, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
          break;
        }
        const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        const height = viewport.height;
        for (let y = 0; y < pageHeight; y += Math.max(1, height / 3)) {
          await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
          await page.waitForTimeout(150);
          if (name === "home") {
            record.motionSamples ??= [];
            const sample = await page.evaluate(() => ({
              scrollY: window.scrollY,
              elements: [...document.querySelectorAll("[style*='transform'],.hero-line-in,.hero-copy-in,.nature-mosaic-reveal,.stay-card-reveal,.experience-slide-reveal")].slice(0, 40).map((node) => {
                const style = getComputedStyle(node);
                return { className: typeof node.className === "string" ? node.className.slice(0, 120) : "", transform: style.transform, animationName: style.animationName, animationPlayState: node.getAnimations().some((animation) => animation.playState === "running") ? "running" : "idle", opacity: style.opacity };
              }),
            }));
            record.motionSamples.push(sample);
          }
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(350);
        record.networkContentLengthBytes = { ...networkBytes };
        record.metrics = await collectMetrics(page);
        record.metrics.resources.contentLengthBytes = { ...networkBytes };
        const stem = `${name}-${viewport.name}`;
        const fullPath = path.join(OUTPUT, `${stem}-full.png`);
        await page.screenshot({ path: fullPath, fullPage: true, timeout: 20000 }).catch(() => {});
        record.screenshots.push(path.basename(fullPath));
        for (let y = 0, index = 0; y < pageHeight; y += height, index++) {
          await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
          await page.waitForTimeout(180);
          const shot = `${stem}-screen-${String(index + 1).padStart(2, "0")}.png`;
          await page.screenshot({ path: path.join(OUTPUT, shot) });
          record.screenshots.push(shot);
        }
        if (name === "home") {
          if (viewport.name === "desktop") {
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            const header = page.locator("header").first();
            await header.screenshot({ path: path.join(OUTPUT, `home-${viewport.name}-header-top.png`) }).catch(() => {});
            const dropdown = page.getByRole("button", { name: /stay/i }).first();
            if (await dropdown.count()) { await dropdown.hover().catch(() => {}); await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUTPUT, `home-${viewport.name}-dropdown.png`) }); }
            await page.evaluate(() => window.scrollTo({ top: 650, behavior: "instant" }));
            await page.waitForTimeout(180);
            await header.screenshot({ path: path.join(OUTPUT, `home-${viewport.name}-header-scrolled.png`) }).catch(() => {});
            await page.evaluate(() => window.scrollTo({ top: 120, behavior: "instant" }));
            await page.waitForTimeout(180);
            await header.screenshot({ path: path.join(OUTPUT, `home-${viewport.name}-header-scroll-up.png`) }).catch(() => {});
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            await page.keyboard.press("Tab").catch(() => {});
            await page.screenshot({ path: path.join(OUTPUT, `home-${viewport.name}-focus.png`) });
          } else {
            const menu = page.getByRole("button", { name: /menu/i }).first();
            if (await menu.count()) { await menu.click().catch(() => {}); await page.waitForTimeout(150); await page.screenshot({ path: path.join(OUTPUT, `home-${viewport.name}-mobile-menu.png`) }); }
          }
        }
        if (name === "packages") {
          const card = page.locator("main article").first();
          if (await card.count()) {
            await card.hover().catch(() => {});
            await page.screenshot({ path: path.join(OUTPUT, `packages-${viewport.name}-card-hover.png`) });
            await card.locator("a").first().focus().catch(() => {});
            await page.screenshot({ path: path.join(OUTPUT, `packages-${viewport.name}-card-focus.png`) });
          }
        }
        const detailPrefix = name === "packages" ? "/packages/" : name === "accommodation" ? "/accommodation/" : name === "activities" ? "/activities/" : null;
        if (detailPrefix) {
          const detailPaths = await page.locator("a[href]").evaluateAll((links, prefix) => [...new Set(links.map((link) => new URL(link.href).pathname).filter((pathname) => pathname.startsWith(prefix) && pathname !== prefix))], detailPrefix);
          for (const detailPath of detailPaths) if (!seenRoutes.has(detailPath)) { seenRoutes.add(detailPath); routeQueue.push([`${slug(name)}-detail-${slug(detailPath.slice(detailPrefix.length))}`, detailPath]); }
        }
      } catch (error) {
        record.error = error instanceof Error ? error.message : String(error);
        report.failures.push(`${viewport.name} ${route}: ${record.error}`);
      }
      report.pages.push(record);
      await writeFile(path.join(OUTPUT, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }
    await context.close();
    if (!runtimeBlocked) {
      const videoContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, recordVideo: { dir: OUTPUT, size: { width: viewport.width, height: viewport.height } } });
      const videoPage = await videoContext.newPage();
      const response = await videoPage.goto(new URL("/", BASE_URL).href, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null);
      if (response?.ok()) {
        await settle(videoPage);
        const pageHeight = await videoPage.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < pageHeight; y += Math.max(1, viewport.height / 4)) {
          await videoPage.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
          await videoPage.waitForTimeout(650);
        }
        await videoPage.waitForTimeout(700);
        const video = videoPage.video();
        await videoContext.close();
        if (video) {
          const generatedVideo = await video.path();
          const finalVideo = path.join(OUTPUT, `home-${viewport.name}-slow-scroll.webm`);
          await unlink(finalVideo).catch(() => {});
          await rename(generatedVideo, finalVideo);
          report.videos ??= [];
          report.videos.push(path.basename(finalVideo));
        }
      } else {
        await videoContext.close();
      }
    }
    if (runtimeBlocked) break;
  }
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.lighthouse = "Not run by this capture script; Lighthouse CLI is not an installed dependency.";
  await writeFile(path.join(OUTPUT, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
