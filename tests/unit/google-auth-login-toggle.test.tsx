import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import SignupPage from "@/app/(auth)/signup/page";
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

describe("Login Form UI & Toggle Behaviour", () => {
  const dummyAdminAction = vi.fn().mockResolvedValue({ ok: true, redirectTo: "/admin" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with User tab selected by default and has no a11y violations (jest-axe)", async () => {
    const { container } = render(<LoginForm adminAction={dummyAdminAction} />);

    expect(screen.getByRole("tab", { name: /user/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /admin/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("renders Admin tab cleanly without a11y violations (jest-axe)", async () => {
    const { container } = render(<LoginForm adminAction={dummyAdminAction} initialTab="admin" />);

    expect(screen.getByRole("tab", { name: /admin/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /user/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText(/staff email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(/create account/i)).not.toBeInTheDocument();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("switches tabs using arrow keys (ArrowRight / ArrowLeft)", () => {
    render(<LoginForm adminAction={dummyAdminAction} />);

    const userTab = screen.getByRole("tab", { name: /user/i });
    const adminTab = screen.getByRole("tab", { name: /admin/i });

    userTab.focus();
    fireEvent.keyDown(userTab, { key: "ArrowRight" });

    expect(adminTab).toHaveAttribute("aria-selected", "true");
    expect(userTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText(/staff email/i)).toBeInTheDocument();

    fireEvent.keyDown(adminTab, { key: "ArrowLeft" });
    expect(userTab).toHaveAttribute("aria-selected", "true");
    expect(adminTab).toHaveAttribute("aria-selected", "false");
  });

  it("displays proper error message and switch button when redirected with staff_account_not_allowed", () => {
    render(
      <LoginForm
        adminAction={dummyAdminAction}
        urlError="staff_account_not_allowed"
      />,
    );

    expect(
      screen.getByText(/this email belongs to a staff account\. please switch to the admin tab to sign in\./i),
    ).toBeInTheDocument();

    // Clicking 'Switch to Admin tab' switches tabs
    fireEvent.click(screen.getByRole("button", { name: /switch to admin tab/i }));
    expect(screen.getByRole("tab", { name: /admin/i })).toHaveAttribute("aria-selected", "true");
  });

  it("displays proper error message when redirected with access_denied", () => {
    render(
      <LoginForm
        adminAction={dummyAdminAction}
        urlError="access_denied"
      />,
    );
    expect(screen.getByText(/google sign-in was cancelled/i)).toBeInTheDocument();
  });

  it("displays proper error message when redirected with email_not_verified", () => {
    render(
      <LoginForm
        adminAction={dummyAdminAction}
        urlError="email_not_verified"
      />,
    );
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

    render(<LoginForm adminAction={dummyAdminAction} defaultValues={{ callbackUrl: "/account/bookings" }} />);

    const googleBtn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/account/bookings",
          errorURL: "/login?tab=user&callbackUrl=%2Faccount%2Fbookings",
        }),
      });
      expect(assignMock).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?client_id=mock");
    });

    fetchMock.mockRestore();
    window.location.assign = originalAssign;
  });

  it("has 'Forgot password?' link pointing to /forgot-password?role=admin and no 'Create account' link", () => {
    render(<LoginForm adminAction={dummyAdminAction} initialTab="admin" />);

    const forgotLink = screen.getByRole("link", { name: /forgot password\?/i });
    expect(forgotLink).toHaveAttribute("href", "/forgot-password?role=admin");
    expect(screen.queryByRole("link", { name: /create account/i })).not.toBeInTheDocument();
  });
});

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

