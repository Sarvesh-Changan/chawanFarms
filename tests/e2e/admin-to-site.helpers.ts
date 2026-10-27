import { expect, type Page } from "@playwright/test";

export const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/accommodation",
  "/activities",
  "/experiences",
  "/food",
  "/faqs",
  "/gallery",
  "/packages",
  "/rewards",
  "/stories",
  "/contact",
  "/policies",
  "/privacy",
  "/terms",
  "/location",
  "/book",
] as const;

export type PageDiagnostic = {
  route: string;
  elapsedMs: number;
  status: number;
  canonical: string | null;
  jsonLdCount: number;
  imageCount: number;
  hasDocumentOverflow: boolean;
  overflowSources: Array<{ tag: string; id: string; className: string; scrollWidth: number; clientWidth: number }>;
  brokenImageCount: number;
};

export function qaConfigured(): boolean {
  return Boolean(process.env.QA_ADMIN_EMAIL && process.env.QA_ADMIN_PASSWORD && process.env.QA_PROPAGATION_PUBLIC_PATH);
}

export async function loginAsStaff(page: Page): Promise<void> {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD are required.");

  await page.goto("/login?callbackUrl=%2Fadmin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(?:\/|$)/, { timeout: 15_000 });
}

export async function diagnosePublicPage(page: Page, route: string): Promise<PageDiagnostic> {
  const started = Date.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30_000 });
  expect(response, `No response for ${route}`).not.toBeNull();
  const status = response?.status() ?? 0;
  expect(status, `${route} returned ${status}`).toBeLessThan(400);

  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await expect(page.locator("body")).toBeVisible();
  const result = await page.evaluate(() => {
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')];
    for (const script of jsonLd) JSON.parse(script.textContent ?? "null");
    const images = [...document.images]
      .filter((image) => image.currentSrc || image.src)
      .map((image) => ({ src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth }));
    return {
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      jsonLdCount: jsonLd.length,
      images,
      overflows: document.documentElement.scrollWidth > window.innerWidth + 1,
      overflowSources: [...document.querySelectorAll("body *")]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .slice(0, 8)
        .map((element) => ({ tag: element.tagName, id: element.id, className: typeof element.className === "string" ? element.className : "", scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
    };
  });

  return {
    route,
    elapsedMs: Date.now() - started,
    status,
    canonical: result.canonical,
    jsonLdCount: result.jsonLdCount,
    imageCount: result.images.length,
    hasDocumentOverflow: result.overflows,
    overflowSources: result.overflowSources,
    brokenImageCount: result.images.filter((image) => image.complete && image.width === 0).length,
  };
}

export async function waitForText(page: Page, text: string, timeoutMs = 5_000): Promise<number> {
  const started = Date.now();
  await expect.poll(async () => (await page.locator("body").innerText()).includes(text), { timeout: timeoutMs }).toBe(true);
  return Date.now() - started;
}

export async function waitForTextAfterNavigation(page: Page, path: string, text: string, timeoutMs = 5_000): Promise<number> {
  const started = Date.now();
  await expect.poll(async () => {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    return (await page.locator("body").innerText()).includes(text);
  }, { timeout: timeoutMs, intervals: [250, 500, 1_000] }).toBe(true);
  return Date.now() - started;
}
