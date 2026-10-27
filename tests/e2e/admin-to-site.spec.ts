import { expect, test } from "@playwright/test";

import { diagnosePublicPage, loginAsStaff, PUBLIC_ROUTES, qaConfigured, waitForTextAfterNavigation } from "./admin-to-site.helpers";

test.use({ baseURL: process.env.QA_BASE_URL ?? "http://127.0.0.1:3000" });

const baseRoutes = [...PUBLIC_ROUTES, "/sitemap.xml"];

test.describe("anonymous public-site propagation diagnostics", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} public pages have no browser errors or broken media`, async ({ browser }, testInfo) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedResponses: string[] = [];
      const externalFailures: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" || /hydration/i.test(message.text())) consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400) {
          const detail = `${response.status()} ${response.url()}`;
          if (response.url().startsWith("https://challenges.cloudflare.com/")) externalFailures.push(detail);
          else failedResponses.push(detail);
        }
      });

      const diagnostics = [];
      for (const route of baseRoutes) {
        if (route === "/sitemap.xml") {
          const response = await page.goto(route, { waitUntil: "domcontentloaded" });
          expect(response?.status()).toBe(200);
          expect(await page.locator("body").innerText()).toContain("<urlset");
          continue;
        }
        diagnostics.push(await diagnosePublicPage(page, route));
      }

      const documentOverflowFailures = diagnostics.filter((diagnostic) => diagnostic.hasDocumentOverflow);
      const imageFailures = diagnostics.filter((diagnostic) => diagnostic.brokenImageCount > 0);
      const canonicalFailures = diagnostics.filter((diagnostic) => diagnostic.canonical === null);
      expect(documentOverflowFailures, `document horizontal overflow: ${JSON.stringify(documentOverflowFailures)}`).toEqual([]);
      expect(imageFailures, `broken images: ${JSON.stringify(imageFailures)}`).toEqual([]);
      expect(canonicalFailures, `missing canonical links: ${JSON.stringify(canonicalFailures)}`).toEqual([]);
      expect(failedResponses, `failed app responses: ${failedResponses.join(" | ")}`).toEqual([]);
      const expectedExternalConsoleErrors = externalFailures.length;
      const relevantConsoleErrors = consoleErrors.filter((message) => !/server responded with a status of 400/i.test(message));
      expect(relevantConsoleErrors, `console errors: ${relevantConsoleErrors.join(" | ")}`).toEqual([]);
      expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
      testInfo.annotations.push({ type: "qa-diagnostics", description: JSON.stringify(diagnostics) });
      if (expectedExternalConsoleErrors) testInfo.annotations.push({ type: "external-failures", description: JSON.stringify(externalFailures) });
      await context.close();
    });
  }
});

test.describe("admin to anonymous propagation", () => {
  test.skip(!qaConfigured(), "Set QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD and QA_PROPAGATION_PUBLIC_PATH to run the guarded DEV mutation flow.");

  test("publishing a QA-prefixed content edit is visible to an already-open anonymous visitor", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const visitorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const admin = await adminContext.newPage();
    const visitor = await visitorContext.newPage();
    const marker = `QA-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
    const publicPath = process.env.QA_PROPAGATION_PUBLIC_PATH as string;
    const editorPath = process.env.QA_PROPAGATION_EDITOR_PATH ?? "/admin/cms/faq/new";
    const fieldLabel = process.env.QA_PROPAGATION_FIELD_LABEL ?? "Question (English)";

    await loginAsStaff(admin);
    await visitor.goto(publicPath, { waitUntil: "networkidle" });
    await admin.goto(editorPath);
    await admin.getByLabel(fieldLabel).fill(marker);
    await admin.getByRole("button", { name: "Save draft" }).click();
    await admin.getByRole("button", { name: "Publish" }).click();

    const delayMs = await waitForTextAfterNavigation(visitor, publicPath, marker);
    expect(delayMs, `Propagation exceeded 5 seconds: ${delayMs}ms`).toBeLessThanOrEqual(5_000);

    // Cleanup is intentionally part of the guarded flow. The test never runs without explicit QA credentials.
    const moveToTrash = admin.getByRole("button", { name: /move to trash/i });
    if (await moveToTrash.count()) {
      await moveToTrash.click();
      const confirm = admin.getByRole("button", { name: /soft-delete|confirm/i }).last();
      if (await confirm.count()) await confirm.click();
    }
    await adminContext.close();
    await visitorContext.close();
  });
});
