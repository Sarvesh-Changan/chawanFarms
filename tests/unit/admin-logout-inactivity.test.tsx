import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { AdminInactivityTracker } from "@/components/admin/AdminInactivityTracker";
import * as authActions from "@/server/auth/actions";

vi.mock("@/server/auth/actions", () => ({
  logoutAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe("AdminLogoutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the logout button and calls logoutAction when clicked", async () => {
    render(<AdminLogoutButton />);
    const button = screen.getByRole("button", { name: /Log out of admin workspace/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Log out");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(authActions.logoutAction).toHaveBeenCalledTimes(1);
  });
});

describe("AdminInactivityTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes last activity in localStorage", () => {
    render(<AdminInactivityTracker timeoutMs={30000} warningBeforeMs={10000} />);
    const stored = localStorage.getItem("cf_admin_last_activity");
    expect(stored).toBeTruthy();
    expect(Number(stored)).toBeGreaterThan(0);
  });

  it("triggers warning toast before timeout and logs out when timeout reached", async () => {
    const { toast } = await import("sonner");
    render(<AdminInactivityTracker timeoutMs={30000} warningBeforeMs={10000} />);

    // Advance 21 seconds (within 10s warning window of 30s timeout)
    await act(async () => {
      vi.advanceTimersByTime(21000);
    });

    expect(toast.warning).toHaveBeenCalled();

    // Advance past the 30s timeout
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(toast.error).toHaveBeenCalledWith("You have been logged out due to 30 minutes of inactivity.");
    expect(authActions.logoutAction).toHaveBeenCalled();
  });
});
