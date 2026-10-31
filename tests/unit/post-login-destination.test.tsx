import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import AccountLayout from "@/app/account/layout";
import { AccountNav } from "@/components/account/AccountNav";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";

vi.mock("next/navigation", () => ({ usePathname: () => "/account" }));

const layoutMocks = vi.hoisted(() => ({ requireCustomer: vi.fn(), getCustomerIdentity: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireCustomer: layoutMocks.requireCustomer }));
vi.mock("@/server/services/account", () => ({ getCustomerIdentity: layoutMocks.getCustomerIdentity }));

const resolve = (userType: "STAFF" | "CUSTOMER", callbackUrl?: unknown, options: { needsTwoFactorSetup?: boolean; needsTwoFactorVerify?: boolean; emailVerified?: boolean } = {}) =>
  resolvePostLoginDestination({
    userType,
    callbackUrl,
    needsTwoFactorSetup: options.needsTwoFactorSetup ?? false,
    needsTwoFactorVerify: options.needsTwoFactorVerify ?? false,
    emailVerified: options.emailVerified ?? true,
  });

describe("resolvePostLoginDestination", () => {
  it("sends staff to the admin dashboard by default", () => {
    expect(resolve("STAFF").redirectTo).toBe("/admin");
  });

  it("honours an admin callback for staff", () => {
    expect(resolve("STAFF", "/admin/bookings?status=confirmed").redirectTo).toBe("/admin/bookings?status=confirmed");
  });

  it("ignores account callbacks for staff", () => {
    expect(resolve("STAFF", "/account").redirectTo).toBe("/admin");
  });

  it.each(["//evil.com", "https://evil.com", "/\\\\evil", "javascript:alert(1)", "/%2f%2fevil.com", "/%252f%252fevil.com", "/%5c%5cevil.com"])(
    "rejects unsafe callback %s for staff",
    (callbackUrl) => expect(resolve("STAFF", callbackUrl).redirectTo).toBe("/admin"),
  );

  it("sends customers to the account area by default and accepts public callbacks", () => {
    expect(resolve("CUSTOMER").redirectTo).toBe("/account");
    expect(resolve("CUSTOMER", "/book?package=weekend").redirectTo).toBe("/book?package=weekend");
  });

  it("ignores admin callbacks for customers", () => {
    expect(resolve("CUSTOMER", "/admin/bookings").redirectTo).toBe("/account");
  });

  it("routes an unverified customer through email verification before the destination", () => {
    expect(resolve("CUSTOMER", "/book", { emailVerified: false })).toMatchObject({
      destination: "/book",
      step: "email-verification",
      redirectTo: "/verify-email?callbackUrl=%2Fbook",
    });
  });

  it("routes required two-factor setup or verification before the destination", () => {
    expect(resolve("STAFF", "/admin/bookings", { needsTwoFactorSetup: true, needsTwoFactorVerify: true })).toMatchObject({
      destination: "/admin/bookings",
      step: "two-factor-setup",
      redirectTo: "/admin/security/two-factor?step=setup&callbackUrl=%2Fadmin%2Fbookings",
    });
    expect(resolve("STAFF", "/admin", { needsTwoFactorVerify: true }).step).toBe("two-factor-verify");
  });

  it("falls back by role when the callback is missing", () => {
    expect(resolve("STAFF", undefined).destination).toBe("/admin");
    expect(resolve("CUSTOMER", undefined).destination).toBe("/account");
  });
});

describe("account navigation access", () => {
  it("includes the website link in the shared account layout with no axe violations", async () => {
    layoutMocks.requireCustomer.mockResolvedValue({ user: { id: "customer-id" } });
    layoutMocks.getCustomerIdentity.mockResolvedValue({
      id: "customer-id",
      email: "customer@example.test",
      emailVerified: true,
      name: "Customer",
      status: "ACTIVE",
      profile: null,
    });
    const layout = await AccountLayout({ children: <p>Account content</p> });
    const { container, getAllByRole } = render(layout);
    const links = getAllByRole("link", { name: /back to website/i });
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute("href") === "/")).toBe(true);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("includes the same website link in the empty account navigation component", async () => {
    const { getAllByRole } = render(<AccountNav />);
    expect(getAllByRole("link", { name: /back to website/i })).toHaveLength(2);
  });
});
