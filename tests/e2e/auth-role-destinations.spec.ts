import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: process.env.QA_BASE_URL ?? "http://127.0.0.1:3000", viewport: { width: 1440, height: 900 } });

type Credentials = { email: string; password: string };

const superAdmin: Credentials | null = process.env.QA_SUPER_ADMIN_EMAIL && process.env.QA_SUPER_ADMIN_PASSWORD
  ? { email: process.env.QA_SUPER_ADMIN_EMAIL, password: process.env.QA_SUPER_ADMIN_PASSWORD }
  : process.env.QA_ADMIN_EMAIL && process.env.QA_ADMIN_PASSWORD
    ? { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD }
    : null;
const reservations: Credentials | null = process.env.QA_RESERVATIONS_EMAIL && process.env.QA_RESERVATIONS_PASSWORD
  ? { email: process.env.QA_RESERVATIONS_EMAIL, password: process.env.QA_RESERVATIONS_PASSWORD }
  : null;
const customer: Credentials | null = process.env.QA_CUSTOMER_EMAIL && process.env.QA_CUSTOMER_PASSWORD
  ? { email: process.env.QA_CUSTOMER_EMAIL, password: process.env.QA_CUSTOMER_PASSWORD }
  : null;

async function login(page: Page, credentials: Credentials): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("server-computed role destinations", () => {
  test("seeded Super Admin lands on /admin", async ({ page }) => {
    if (!superAdmin) { test.skip(true, "Set QA_SUPER_ADMIN_EMAIL and QA_SUPER_ADMIN_PASSWORD (or QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD)."); return; }
    await login(page, superAdmin);
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test("seeded Reservations staff lands on /admin", async ({ page }) => {
    if (!reservations) { test.skip(true, "Set QA_RESERVATIONS_EMAIL and QA_RESERVATIONS_PASSWORD for the seeded Reservations role."); return; }
    await login(page, reservations);
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test("seeded customer lands on /account", async ({ page }) => {
    if (!customer) { test.skip(true, "Set QA_CUSTOMER_EMAIL and QA_CUSTOMER_PASSWORD for a seeded customer."); return; }
    await login(page, customer);
    await expect(page).toHaveURL(/\/account\/?$/);
  });

  test("staff visiting account, login, or signup is sent to the admin dashboard", async ({ page }) => {
    if (!superAdmin) { test.skip(true, "Set QA_SUPER_ADMIN_EMAIL and QA_SUPER_ADMIN_PASSWORD."); return; }
    await login(page, superAdmin);
    await expect(page).toHaveURL(/\/admin\/?$/);

    for (const path of ["/account", "/login", "/signup"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/?$/);
    }
  });

  test("customer login and signup visits return to account; admin access remains forbidden", async ({ page }) => {
    if (!customer) { test.skip(true, "Set QA_CUSTOMER_EMAIL and QA_CUSTOMER_PASSWORD."); return; }
    await login(page, customer);
    await expect(page).toHaveURL(/\/account\/?$/);

    for (const path of ["/login", "/signup"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/account\/?$/);
    }

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole("heading", { name: "Staff access required" })).toBeVisible();
  });

  test("public header shows one role-appropriate link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Login", exact: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

    if (!superAdmin || !customer) { test.skip(true, "Set staff and customer QA credentials to verify signed-in header labels."); return; }
    await login(page, superAdmin);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveAttribute("href", "/admin");
    await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveCount(0);

    await page.context().clearCookies();
    await login(page, customer);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("href", "/account");
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  });

  test("every account section, including details and upload, has a home link", async ({ page }) => {
    if (!customer) { test.skip(true, "Set QA_CUSTOMER_EMAIL and QA_CUSTOMER_PASSWORD for a seeded customer."); return; }
    await login(page, customer);
    const paths = [
      "/account",
      "/account/bookings",
      "/account/bookings/00000000-0000-4000-8000-000000000000",
      "/account/enquiries",
      "/account/enquiries/00000000-0000-4000-8000-000000000000",
      "/account/rewards",
      "/account/coupons",
      "/account/videos",
      "/account/videos/new",
      "/account/favourites",
      "/account/notifications",
      "/account/profile",
      "/account/privacy",
      "/account/points",
      "/account/ledger",
      "/account/referrals",
    ];

    for (const path of paths) {
      await page.goto(path);
      const backLink = page.getByRole("link", { name: /back to website/i }).first();
      await expect(backLink).toHaveAttribute("href", "/");
    }
  });
});
