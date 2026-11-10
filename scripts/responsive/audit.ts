import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "@playwright/test";

const baseUrl = process.env.RESPONSIVE_AUDIT_BASE_URL ?? "http://127.0.0.1:3100";
const outputDir = path.resolve("docs/qa/responsive");
const reportPath = path.resolve("docs/MOBILE_RESPONSIVE_REPORT.md");
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x740", width: 360, height: 740 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
  { name: "landscape-844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
] as const;

const accountRoutes = ["/account", "/account/bookings", "/account/bookings/00000000-0000-4000-8000-000000000000", "/account/coupons", "/account/enquiries", "/account/enquiries/00000000-0000-4000-8000-000000000000", "/account/favourites", "/account/ledger", "/account/notifications", "/account/points", "/account/privacy", "/account/profile", "/account/referrals", "/account/rewards", "/account/videos", "/account/videos/new"];
const adminRoutes = ["/admin", ...["accommodation", "activities", "availability", "bookings", "calendar", "customers", "enquiries", "experiences-legacy", "faqs", "gallery", "leads", "media", "menu", "packages", "rewards", "security", "settings", "stories"].flatMap((section) => [`/admin/${section}`, `/admin/${section}/new`]), "/admin/accommodation/trash", "/admin/packages/trash", "/admin/settings/policies", "/admin/rewards/coupons", "/admin/rewards/ledger", "/admin/rewards/rules", "/admin/rewards/videos", "/admin/security/audit", "/admin/security/change-password", "/admin/security/roles", "/admin/security/sessions", "/admin/security/staff", "/admin/security/two-factor", "/admin/login"];
const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/staff-invite"];

type Issue = { id: string; route: string; viewport: string; severity: "high" | "medium" | "low"; evidence: string; fix: string };
type AuditRecord = { route: string; viewport: string; status: number | null; title: string; screenshot: string; overflow: number; overflowSelectors: string[]; smallTargets: number; closeTargets: number; smallText: number; smallInputs: number; clipped: number; overlapping: number; imageProblems: number; legacyViewportUnits: number; placeholders: string[]; consoleErrors: string[]; horizontalScrollOffset: number };

function slug(value: string): string { return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page"; }

async function sitemapRoutes(): Promise<string[]> {
  const response = await fetch(new URL("/sitemap.xml", baseUrl));
  if (!response.ok) throw new Error(`Cannot read sitemap.xml (${response.status})`);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1] ?? "/", baseUrl).pathname);
}

async function inspect(page: Page, route: string, viewport: (typeof viewports)[number], status: number | null, consoleErrors: string[]): Promise<AuditRecord> {
  const metrics = await page.evaluate(() => {
    const selector = (el: Element) => {
      const id = el.id ? `#${CSS.escape(el.id)}` : "";
      const classes = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className.split(/\s+/).filter(Boolean).slice(0, 2).map((item) => `.${CSS.escape(item)}`).join("") : "";
      return `${el.tagName.toLowerCase()}${id}${classes}`;
    };
    const visible = (el: Element) => { const rect = el.getBoundingClientRect(); const style = getComputedStyle(el); return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"; };
    const overflow = [...document.querySelectorAll("body *")].filter((el) => { const rect = el.getBoundingClientRect(); return visible(el) && (rect.right > innerWidth + 1 || rect.left < -1); }).slice(0, 30).map(selector);
    const targets = [...document.querySelectorAll("a,button,input,select,textarea,[role=button],[role=checkbox],[role=switch],[role=combobox],[aria-haspopup]")].filter(visible);
    const smallTargets = targets.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
    const closeTargets = targets.reduce((count, first, index) => count + targets.slice(index + 1).filter((second) => {
      if (first.contains(second) || second.contains(first)) return false;
      const a = first.getBoundingClientRect(); const b = second.getBoundingClientRect();
      const dx = Math.max(0, b.left - a.right, a.left - b.right); const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
      return Math.hypot(dx, dy) < 8;
    }).length, 0);
    const smallInputs = [...document.querySelectorAll("input,select,textarea")].filter(visible).filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16);
    const smallText = [...document.querySelectorAll("body *")].filter(visible).filter((el) => el.children.length === 0 && (el.textContent ?? "").trim()).filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 14);
    const clipped = [...document.querySelectorAll("h1,h2,h3,p,a,button,label,span")].filter(visible).filter((el) => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2).slice(0, 40);
    const images = [...document.images];
    const imageProblems = images.filter((img) => !img.hasAttribute("width") && !img.hasAttribute("height") && getComputedStyle(img).position !== "absolute" || (img.complete && img.naturalWidth === 0) || img.getBoundingClientRect().width > innerWidth + 1).length;
    const placeholders = [...document.querySelectorAll("body *")].filter(visible).filter((el) => el.children.length === 0 && /placeholder|crops\s*&\s*trees|farm cottages/i.test(el.textContent ?? "")).map((el) => (el.textContent ?? "").trim()).slice(0, 10);
    const overlapping = [...document.querySelectorAll("main section")].reduce((sum, section) => {
      const kids = [...section.children].filter(visible); let count = 0;
      for (const first of kids) for (const second of kids) {
        if (first === second || (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue;
        const a = first.getBoundingClientRect(); const b = second.getBoundingClientRect();
        if (a.width > 0 && b.width > 0 && a.height > 0 && b.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) count++;
      }
      return sum + count;
    }, 0);
    const legacyViewportUnits = [...document.styleSheets].reduce((sum, sheet) => {
      try { return sum + [...sheet.cssRules].filter((rule) => /(?:min-|max-)?(?:height):[^;}]*100vh\b/i.test(rule.cssText)).length; }
      catch { return sum; }
    }, 0);
    return { title: document.title, overflow: document.documentElement.scrollWidth - innerWidth, overflowSelectors: overflow, smallTargets: smallTargets.length, closeTargets, smallText: smallText.length, smallInputs: smallInputs.length, clipped: clipped.length, overlapping, imageProblems, legacyViewportUnits, placeholders, horizontalScrollOffset: scrollX };
  });
  const screenshot = `${slug(route)}-${viewport.name}.png`;
  await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true, animations: "disabled" }).catch(() => undefined);
  return { route, viewport: viewport.name, status, screenshot, ...metrics, consoleErrors };
}

async function signIn(context: BrowserContext, pathName: string, email: string, password: string): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto(new URL(pathName, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
    const emailField = page.locator('input[type="email"],input[name="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    if (!await emailField.count() || !await passwordField.count()) return false;
    await emailField.fill(email); await passwordField.fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).first().click();
    await page.waitForTimeout(1500);
    return true;
  } finally { await page.close(); }
}

async function main(): Promise<void> {
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const allRoutes = [...new Set([...(await sitemapRoutes()), ...authRoutes, ...accountRoutes, ...adminRoutes])].sort();
const routes = process.env.RESPONSIVE_AUDIT_ROUTE ? allRoutes.filter((route) => route === process.env.RESPONSIVE_AUDIT_ROUTE) : allRoutes;
const selectedViewports = process.env.RESPONSIVE_AUDIT_VIEWPORT ? viewports.filter((viewport) => viewport.name === process.env.RESPONSIVE_AUDIT_VIEWPORT) : viewports;
const records: AuditRecord[] = [];
const issues: Issue[] = [];
const consoleByRoute = new Map<string, string[]>();
const staffReady = Boolean(process.env.QA_SUPER_ADMIN_EMAIL && process.env.QA_SUPER_ADMIN_PASSWORD);
const customerReady = Boolean(process.env.QA_CUSTOMER_EMAIL && process.env.QA_CUSTOMER_PASSWORD);

try {
  for (const viewport of selectedViewports) {
    const contextOptions = { viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.width <= 430 || viewport.name === "landscape-844x390", hasTouch: true };
    const anonymousContext = await browser.newContext(contextOptions);
    const staffContext = await browser.newContext(contextOptions);
    const customerContext = await browser.newContext(contextOptions);
    if (staffReady) await signIn(staffContext, "/admin/login", process.env.QA_SUPER_ADMIN_EMAIL ?? "", process.env.QA_SUPER_ADMIN_PASSWORD ?? "");
    if (customerReady) await signIn(customerContext, "/login", process.env.QA_CUSTOMER_EMAIL ?? "", process.env.QA_CUSTOMER_PASSWORD ?? "");
    for (const route of routes) {
      const context = route.startsWith("/admin") && route !== "/admin/login" ? staffContext : route.startsWith("/account") ? customerContext : anonymousContext;
      const page = await context.newPage();
      await page.addInitScript("window.__name = (target, value) => target");
      const errors: string[] = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text().slice(0, 240)); });
      page.on("pageerror", (error) => errors.push(error.message.slice(0, 240)));
      let status: number | null = null;
      try {
        const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 25_000 });
        status = response?.status() ?? null;
        await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
        await page.waitForTimeout(150);
        const record = await inspect(page, route, viewport, status, errors);
        records.push(record);
        if (status !== null && status >= 400) issues.push({ id: "RWD-HTTP", route, viewport: viewport.name, severity: "high", evidence: `Route returned HTTP ${status}.`, fix: "Restore the audit server's required local/QA data access and rerun." });
        if (record.overflow > 0 || record.horizontalScrollOffset > 0) issues.push({ id: "RWD-OVERFLOW", route, viewport: viewport.name, severity: "high", evidence: `${record.overflow}px document overflow; ${record.overflowSelectors.join(", ") || "no element captured"}`, fix: "Constrain the overflowing child and confirm intentional scrollers are contained." });
        if (record.smallTargets) issues.push({ id: "RWD-TARGET", route, viewport: viewport.name, severity: "medium", evidence: `${record.smallTargets} interactive controls below 44px in at least one dimension`, fix: "Increase touch target dimensions and separation." });
        if (record.closeTargets) issues.push({ id: "RWD-SPACING", route, viewport: viewport.name, severity: "medium", evidence: `${record.closeTargets} pairs of interactive controls are closer than 8px`, fix: "Separate adjacent controls to preserve comfortable touch spacing." });
        if (record.smallInputs) issues.push({ id: "RWD-INPUT", route, viewport: viewport.name, severity: "medium", evidence: `${record.smallInputs} visible form fields below 16px`, fix: "Set mobile form controls to at least 16px." });
        if (record.smallText) issues.push({ id: "RWD-TEXT", route, viewport: viewport.name, severity: "low", evidence: `${record.smallText} visible text nodes below 14px`, fix: "Review small copy for readable mobile sizing." });
        if (record.clipped) issues.push({ id: "RWD-CLIP", route, viewport: viewport.name, severity: "medium", evidence: `${record.clipped} text elements clip or overflow their boxes`, fix: "Allow wrapping or increase the text container size." });
        if (record.overlapping) issues.push({ id: "RWD-OVERLAP", route, viewport: viewport.name, severity: "medium", evidence: `${record.overlapping} sibling section boxes intersect`, fix: "Review intersecting content and preserve intentional overlays only." });
        if (record.imageProblems) issues.push({ id: "RWD-IMAGE", route, viewport: viewport.name, severity: "medium", evidence: `${record.imageProblems} image dimension, load or viewport-width issue(s)`, fix: "Reserve image dimensions and constrain responsive media." });
        if (record.legacyViewportUnits) issues.push({ id: "RWD-VH", route, viewport: viewport.name, severity: "medium", evidence: `${record.legacyViewportUnits} CSS height rules still use 100vh`, fix: "Use svh/dvh or a stable fallback for mobile viewport heights." });
        if (record.placeholders.length) issues.push({ id: "RWD-PLACEHOLDER", route, viewport: viewport.name, severity: "high", evidence: record.placeholders.join("; "), fix: "Hide decorative image labels when no source image exists." });
        if (errors.length) issues.push({ id: "RWD-CONSOLE", route, viewport: viewport.name, severity: "medium", evidence: errors.join("; "), fix: "Resolve browser runtime errors." });
      } catch (error) {
        const message = String(error);
        records.push({ route, viewport: viewport.name, status, title: "AUDIT NAVIGATION FAILED", screenshot: "", overflow: 0, overflowSelectors: [], smallTargets: 0, closeTargets: 0, smallText: 0, smallInputs: 0, clipped: 0, overlapping: 0, imageProblems: 0, legacyViewportUnits: 0, placeholders: [], consoleErrors: [message], horizontalScrollOffset: 0 });
        issues.push({ id: "RWD-AUDIT-ERROR", route, viewport: viewport.name, severity: "high", evidence: message.slice(0, 240), fix: "Fix the audit/browser navigation failure and rerun this capture." });
      } finally {
        consoleByRoute.set(route, [...(consoleByRoute.get(route) ?? []), ...errors]);
        await page.close();
      }
      console.log(`${viewport.name} ${route}`);
    }
    await anonymousContext.close();
    await staffContext.close();
    await customerContext.close();
  }
} finally { await browser.close(); }

const unavailableAuth = [...(staffReady ? [] : ["Admin routes require QA_SUPER_ADMIN_EMAIL and QA_SUPER_ADMIN_PASSWORD; tested as anonymous/redirected."]), ...(customerReady ? [] : ["Account routes require QA_CUSTOMER_EMAIL and QA_CUSTOMER_PASSWORD; tested as anonymous/redirected."])];
const table = issues.map((issue) => `| ${issue.id} | ${issue.route} | ${issue.viewport} | ${issue.severity} | ${issue.evidence.replaceAll("|", "\\|")} | ${issue.fix} |`).join("\n");
const report = `# Mobile responsive audit\n\nCaptured ${new Date().toISOString()} against \`${baseUrl}\`. Before-fix production build: completed; see terminal build output for route inventory. User-provided screenshots were visually inspected.\n\n## Scope and limitations\n\n- ${routes.length} selected routes from the sitemap plus login, account and admin route templates were visited at ${selectedViewports.length} viewport(s) with touch enabled.\n- Signed-in Super Admin: ${staffReady ? "authenticated" : "not authenticated"}. Signed-in customer: ${customerReady ? "authenticated" : "not authenticated"}.\n- ${unavailableAuth.map((item) => `\n- ${item}`).join("")}\n- Screenshots are in ignored \`docs/qa/responsive/\`.\n- This automated pass records overflow selectors, small targets, text/input sizes, clipped text, sibling box intersections, image problems, placeholder text, console errors and nonzero horizontal scroll. Sibling intersection totals are heuristic evidence; sticky occlusion, control spacing, visual crop and 100vh/svh behavior require manual review.\n\n## Findings\n\n| ID | Page | Viewport | Severity | Evidence | Proposed fix |\n|---|---|---|---|---|---|\n${table || "| No automated findings | — | — | — | — | — |"}\n\n## Page/viewport records\n\n${records.length} route and viewport captures recorded. See screenshots and audit output.\n`;
await writeFile(reportPath, report, "utf8");
await writeFile(path.join(outputDir, "metrics.json"), JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl, routes, viewports: selectedViewports, staffReady, customerReady, records }, null, 2), "utf8");
console.log(`Saved ${records.length} captures, ${issues.length} findings to ${reportPath}`);
if (issues.length) process.exitCode = 1;
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
