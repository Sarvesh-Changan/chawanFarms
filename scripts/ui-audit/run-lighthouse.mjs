import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.UI_AUDIT_BASE_URL ?? "http://127.0.0.1:3103";
const ROOT = path.resolve("docs/qa/ui-audit");
const METRICS_PATH = path.join(ROOT, "metrics.json");
const OUTPUT = path.join(ROOT, "lighthouse");
const CONCURRENCY = Math.max(1, Math.min(1, Number(process.env.UI_AUDIT_LIGHTHOUSE_CONCURRENCY ?? 1)));

async function findLighthouse() {
  const explicit = process.env.UI_AUDIT_LIGHTHOUSE_DIR;
  if (explicit) return explicit;
  const npmCache = path.join(process.env.LOCALAPPDATA ?? "", "npm-cache", "_npx");
  for (const directory of await readdir(npmCache, { withFileTypes: true }).catch(() => [])) {
    if (!directory.isDirectory()) continue;
    const candidate = path.join(npmCache, directory.name, "node_modules", "lighthouse");
    try { await readFile(path.join(candidate, "core", "index.js")); return candidate; } catch {}
  }
  throw new Error("Lighthouse is not available in the npm cache. Use npx --yes lighthouse once, without adding a project dependency.");
}

function fileKey(viewport, route) {
  return `${viewport}-${route.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home"}`;
}

function summaryOf(lhr, route, viewport) {
  const score = (id) => lhr.categories[id]?.score == null ? null : Math.round(lhr.categories[id].score * 100);
  const metric = (id) => lhr.audits[id]?.numericValue ?? null;
  const summary = lhr.audits["resource-summary"]?.details?.items ?? [];
  return {
    route, viewport, finalUrl: lhr.finalDisplayedUrl,
    scores: { performance: score("performance"), accessibility: score("accessibility"), bestPractices: score("best-practices"), seo: score("seo") },
    metrics: { lcpMs: metric("largest-contentful-paint"), cls: metric("cumulative-layout-shift"), inpMs: metric("interaction-to-next-paint"), tbtMs: metric("total-blocking-time"), totalBytes: metric("total-byte-weight") },
    resourceSummary: summary,
    warnings: lhr.runtimeError ? [lhr.runtimeError.message] : [],
  };
}

if (!process.env.UI_AUDIT_LIGHTHOUSE_PARTITION && !process.env.UI_AUDIT_LIGHTHOUSE_ROUTE) {
  await mkdir(OUTPUT, { recursive: true });
  const scriptPath = fileURLToPath(import.meta.url);
  const partitions = 2;
  const childRuns = Array.from({ length: partitions }, (_, partition) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, UI_AUDIT_LIGHTHOUSE_PARTITION: String(partition), UI_AUDIT_LIGHTHOUSE_PARTITIONS: String(partitions), UI_AUDIT_LIGHTHOUSE_CONCURRENCY: "1" },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Lighthouse worker ${partition} exited ${code}`)));
  }));
  await Promise.all(childRuns);
  const summaries = await Promise.all(Array.from({ length: partitions }, async (_, partition) => {
    const partPath = path.join(OUTPUT, `summary-part-${partition}.json`);
    return JSON.parse(await readFile(partPath, "utf8"));
  }));
  const allResults = summaries.flatMap((summary) => summary.results);
  for (const viewport of ["desktop", "mobile"]) {
    const homePath = path.join(OUTPUT, `home-${viewport}.json`);
    try { allResults.push(summaryOf(JSON.parse(await readFile(homePath, "utf8")), "/", viewport)); } catch {}
  }
  allResults.sort((a, b) => `${a.viewport} ${a.route}`.localeCompare(`${b.viewport} ${b.route}`));
  await writeFile(path.join(OUTPUT, "summary.json"), `${JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, lighthouseVersion: "12.8.2", concurrency: partitions, results: allResults }, null, 2)}\n`, "utf8");
  process.stdout.write(`Lighthouse complete: ${allResults.length} route/viewport records\n`);
  process.exit(0);
}

const metricReport = JSON.parse(await readFile(METRICS_PATH, "utf8"));
const unique = new Map();
for (const page of metricReport.pages) {
  const key = `${page.viewport} ${page.route}`;
  if (!unique.has(key)) unique.set(key, { viewport: page.viewport, route: page.route });
}
const allJobs = [...unique.values()].filter(({ route }) => route !== "/"); // Home was measured separately and is preserved.
const partitionCount = Number(process.env.UI_AUDIT_LIGHTHOUSE_PARTITIONS ?? 1);
const partitionIndex = Number(process.env.UI_AUDIT_LIGHTHOUSE_PARTITION ?? 0);
const jobs = allJobs.filter((job, index) => (!process.env.UI_AUDIT_LIGHTHOUSE_ROUTE || job.route === process.env.UI_AUDIT_LIGHTHOUSE_ROUTE) && (index % partitionCount) === partitionIndex);
const summaryPath = path.join(OUTPUT, process.env.UI_AUDIT_LIGHTHOUSE_PARTITION ? `summary-part-${partitionIndex}.json` : "summary.json");
const lighthouseDir = await findLighthouse();
const requireFromLighthouse = createRequire(path.join(lighthouseDir, "package.json"));
const chromeLauncher = requireFromLighthouse("chrome-launcher");
const lighthouseModule = await import(pathToFileURL(requireFromLighthouse.resolve("./core/index.js")).href);
const lighthouse = lighthouseModule.default;
const chromePath = chromium.executablePath();
await import("node:fs/promises").then(({ mkdir }) => mkdir(OUTPUT, { recursive: true }));
const results = [];
let nextJob = 0;

async function worker() {
  while (nextJob < jobs.length) {
    const job = jobs[nextJob++];
    const url = new URL(job.route, BASE_URL).href;
    const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless", "--no-sandbox"], handleSIGINT: false });
    try {
      const mobile = job.viewport === "mobile";
      const output = await lighthouse(url, {
        port: chrome.port,
        output: "json",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        formFactor: mobile ? "mobile" : "desktop",
        screenEmulation: { mobile, width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 1, disabled: false },
        throttlingMethod: "simulate",
      });
      const summary = summaryOf(output.lhr, job.route, job.viewport);
      const stem = fileKey(job.viewport, job.route);
      results.push(summary);
      await writeFile(path.join(OUTPUT, `${stem}.json`), output.report, "utf8");
      await writeFile(summaryPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, lighthouseVersion: "12.8.2", concurrency: CONCURRENCY, results: results.sort((a, b) => `${a.viewport} ${a.route}`.localeCompare(`${b.viewport} ${b.route}`)) }, null, 2)}\n`, "utf8");
      process.stdout.write(`Lighthouse complete: ${job.viewport} ${job.route}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ route: job.route, viewport: job.viewport, error: message });
      await writeFile(summaryPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, lighthouseVersion: "12.8.2", concurrency: CONCURRENCY, results }, null, 2)}\n`, "utf8");
      process.stderr.write(`Lighthouse failed: ${job.viewport} ${job.route}: ${message}\n`);
    } finally {
      try { await chrome.kill(); } catch {}
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
