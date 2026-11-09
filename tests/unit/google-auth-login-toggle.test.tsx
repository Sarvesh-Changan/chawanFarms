import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import SignupPage from "@/app/(auth)/signup/page";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { forgotPasswordAction, loginAction, signupAction } from "@/server/auth/actions";
import { validateGoogleUserInfo } from "@/server/auth/google-gate";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  accountFindFirst: vi.fn(),
  staffInviteFindFirst: vi.fn(),
  sessionDeleteMany: vi.fn(),
  limit: vi.fn(),
  headers: vi.fn(),
  signInEmail: vi.fn(),
  verifyPassword: vi.fn(),
  resolveUserPostLogin: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({
  permanentRedirect: mocks.permanentRedirect,
  redirect: vi.fn(),
}));
vi.mock("@/server/integrations/ratelimit", () => ({ limit: mocks.limit }));
vi.mock("@better-auth/utils/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      signInEmail: mocks.signInEmail,
    },
  },
}));
vi.mock("@/server/auth/post-login", () => ({
  resolveUserPostLogin: mocks.resolveUserPostLogin,
}));
vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
    },
    staffInvite: {
      findFirst: mocks.staffInviteFindFirst,
    },
    session: {
      deleteMany: mocks.sessionDeleteMany,
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Customer Login Form (/login) — Google sign-in only, no toggle
// ─────────────────────────────────────────────────────────────────────────────
describe("Customer Login Form UI (/login)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Welcome back' heading and Google button, has no a11y violations (jest-axe)", async () => {
    const { container } = render(<LoginForm />);

    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();

    // No admin tab, no toggle, no email/password fields
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/staff email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^password/i)).not.toBeInTheDocument();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("displays staff_account_not_allowed error with a link to /admin/login", () => {
    render(<LoginForm urlError="staff_account_not_allowed" />);

    expect(
      screen.getByText(/this email belongs to a staff account/i),
    ).toBeInTheDocument();

    const adminLink = screen.getByRole("link", { name: /go to admin login/i });
    expect(adminLink).toHaveAttribute("href", "/admin/login");
  });

  it("displays access_denied error message", () => {
    render(<LoginForm urlError="access_denied" />);
    expect(screen.getByText(/google sign-in was cancelled/i)).toBeInTheDocument();
  });

  it("displays email_not_verified error message", () => {
    render(<LoginForm urlError="email_not_verified" />);
    expect(screen.getByText(/your google account email is not verified/i)).toBeInTheDocument();
  });

  it("triggers Google OAuth request when Continue with Google is clicked", async () => {
    const originalAssign = window.location.assign;
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, assign: assignMock },
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=mock" }),
    } as unknown as Response);

    render(<LoginForm defaultValues={{ callbackUrl: "/account/bookings" }} />);

    const googleBtn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/account/bookings",
          errorURL: "/login?callbackUrl=%2Faccount%2Fbookings",
        }),
      });
      expect(assignMock).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?client_id=mock");
    });

    fetchMock.mockRestore();
    window.location.assign = originalAssign;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Login Form (/admin/login) — email + password, no Google
// ─────────────────────────────────────────────────────────────────────────────
describe("Admin Login Form UI (/admin/login)", () => {
  const dummyAdminAction = vi.fn().mockResolvedValue({ ok: true, redirectTo: "/admin" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Admin Login' heading with staff email and password fields, has no a11y violations (jest-axe)", async () => {
    const { container } = render(<AdminLoginForm adminAction={dummyAdminAction} />);

    expect(screen.getByRole("heading", { name: /admin login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/staff email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();

    // No Google button, no toggle
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("has 'Forgot password?' link pointing to /forgot-password?role=admin", () => {
    render(<AdminLoginForm adminAction={dummyAdminAction} />);

    const forgotLink = screen.getByRole("link", { name: /forgot password\?/i });
    expect(forgotLink).toHaveAttribute("href", "/forgot-password?role=admin");
  });

  it("renders inactivity timeout banner when isInactivityTimeout is true", () => {
    render(<AdminLoginForm adminAction={dummyAdminAction} isInactivityTimeout />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/session timed out/i)).toBeInTheDocument();
  });

  it("calls adminAction and redirects on successful sign-in", async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, assign: assignMock },
    });

    render(<AdminLoginForm adminAction={dummyAdminAction} />);

    fireEvent.change(screen.getByLabelText(/staff email/i), {
      target: { value: "staff@chawanfarms.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "valid-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(dummyAdminAction).toHaveBeenCalled();
      expect(assignMock).toHaveBeenCalledWith("/admin");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server-Side Authentication Enforcement
// ─────────────────────────────────────────────────────────────────────────────
describe("Server-Side Authentication Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.limit.mockResolvedValue({ allowed: true });
  });

  it("refuses customer accounts on password login and runs scrypt in constant time", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "customer-1",
      email: "customer@example.com",
      type: "CUSTOMER",
      emailVerified: true,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    mocks.verifyPassword.mockResolvedValue(false);

    const result = await loginAction({
      email: "customer@example.com",
      password: "some-password",
    });

    expect(result).toEqual({
      ok: false,
      message: "Unable to sign in. Check your details and try again.",
    });
    // Verifies dummy scrypt was executed for constant-time mitigation
    expect(mocks.verifyPassword).toHaveBeenCalled();
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("refuses non-existent accounts on password login in constant time", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(false);

    const result = await loginAction({
      email: "unknown@example.com",
      password: "some-password",
    });

    expect(result).toEqual({
      ok: false,
      message: "Unable to sign in. Check your details and try again.",
    });
    expect(mocks.verifyPassword).toHaveBeenCalled();
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("accepts staff accounts on password login and resolves destination", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "staff-1",
      email: "staff@chawanfarms.com",
      type: "STAFF",
      emailVerified: true,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    mocks.signInEmail.mockResolvedValue({
      user: { id: "staff-1" },
    });
    mocks.resolveUserPostLogin.mockResolvedValue({
      destination: "/admin",
      redirectTo: "/admin",
      step: null,
    });

    const result = await loginAction({
      email: "staff@chawanfarms.com",
      password: "valid-staff-password",
      callbackUrl: "/admin",
    });

    expect(result).toEqual({
      ok: true,
      redirectTo: "/admin",
    });
    expect(mocks.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: "staff@chawanfarms.com" }),
      }),
    );
  });

  it("disables customer email/password sign-up endpoint", async () => {
    const result = await signupAction({
      name: "Customer Name",
      email: "customer@chawanfarms.com",
      password: "password123!",
      confirmPassword: "password123!",
    });

    expect(result).toEqual({
      ok: false,
      message: "Unable to sign in. Check your details and try again.",
    });
  });

  it("disables customer password reset endpoint", async () => {
    const result = await forgotPasswordAction({
      email: "customer@example.com",
    });

    expect(result).toEqual({
      ok: false,
      message: "If the details are valid, you will receive an email shortly.",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Old Route Permanent Redirects
// ─────────────────────────────────────────────────────────────────────────────
describe("Old Route Permanent Redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("/signup permanently redirects to /login", () => {
    SignupPage();
    expect(mocks.permanentRedirect).toHaveBeenCalledWith("/login");
  });

  it("/forgot-password without admin role permanently redirects to /login", async () => {
    await ForgotPasswordPage({});
    expect(mocks.permanentRedirect).toHaveBeenCalledWith("/login");
  });

  it("/forgot-password?role=admin renders the staff OTP reset form", async () => {
    const element = await ForgotPasswordPage({
      searchParams: Promise.resolve({ role: "admin" }),
    });

    expect(element).toBeTruthy();
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth Gatekeeping (validateGoogleUserInfo)
// ─────────────────────────────────────────────────────────────────────────────
describe("Google OAuth Gatekeeping (validateGoogleUserInfo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits verified customer Google emails", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.staffInviteFindFirst.mockResolvedValue(null);

    const result = await validateGoogleUserInfo({
      user: {
        email: "verifiedcustomer@gmail.com",
        emailVerified: true,
        name: "Verified Customer",
      },
      source: {
        method: "oauth",
        oauth: { providerId: "google" },
      },
    });

    expect(result).toBeUndefined();
  });

  it("refuses Google accounts with unverified emails", async () => {
    const result = await validateGoogleUserInfo({
      user: {
        email: "unverified@gmail.com",
        emailVerified: false,
      },
      source: {
        method: "oauth",
        oauth: { providerId: "google" },
      },
    });

    expect(result).toEqual({
      error: "email_not_verified",
      errorDescription: expect.stringContaining("not verified"),
    });
  });

  it("refuses Google accounts when email belongs to an existing staff member", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: "staff-admin-id",
      type: "STAFF",
    });

    const result = await validateGoogleUserInfo({
      user: {
        email: "admin@chawanfarms.com",
        emailVerified: true,
      },
      source: {
        method: "oauth",
        oauth: { providerId: "google" },
      },
    });

    expect(result).toEqual({
      error: "staff_account_not_allowed",
      errorDescription: expect.stringContaining("belongs to a staff account"),
    });
  });

  it("refuses Google accounts when email belongs to a pending staff invite", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.staffInviteFindFirst.mockResolvedValue({
      id: "pending-invite-id",
    });

    const result = await validateGoogleUserInfo({
      user: {
        email: "invited-staff@chawanfarms.com",
        emailVerified: true,
      },
      source: {
        method: "oauth",
        oauth: { providerId: "google" },
      },
    });

    expect(result).toEqual({
      error: "staff_account_not_allowed",
      errorDescription: expect.stringContaining("belongs to a staff account"),
    });
  });

  it("ignores non-Google auth sources", async () => {
    const result = await validateGoogleUserInfo({
      user: {
        email: "staff@chawanfarms.com",
        emailVerified: true,
      },
      source: {
        method: "credentials",
      },
    });

    expect(result).toBeUndefined();
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
  });
});
