import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OwnSessions } from "@/components/admin/OwnSessions";
import { formatSessionDate, getRelativeTime, getSessionDeviceDescription, getSessionIpLabel, matchesCurrentSessionToken } from "@/lib/security/sessions";

const mocks = vi.hoisted(() => ({
  revokeOwn: vi.fn(),
  revokeAll: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/server/actions/admin-security", () => ({
  revokeOwnSessionAction: mocks.revokeOwn,
  revokeAllOtherSessionsAction: mocks.revokeAll,
}));

describe("session management presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches the request session token against each database session token", () => {
    expect(matchesCurrentSessionToken("request-token", "request-token")).toBe(true);
    expect(matchesCurrentSessionToken("request-token", "another-token")).toBe(false);
    expect(matchesCurrentSessionToken(undefined, "request-token")).toBe(false);
  });

  it("describes common browsers, operating systems, IPs, and relative dates", () => {
    expect(getSessionDeviceDescription("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36")).toBe("Chrome on Windows");
    expect(getSessionIpLabel("0.0.0.0", false)).toBe("Unknown");
    expect(getSessionIpLabel("::", false)).toBe("Unknown");
    expect(getSessionIpLabel(null, false)).toBe("Unknown");
    expect(getSessionIpLabel("127.0.0.1", true)).toBe("This computer (local)");
    expect(getSessionIpLabel("::1", true)).toBe("This computer (local)");
    expect(getSessionIpLabel("127.0.0.1", false)).toBe("127.0.0.1");
    expect(getRelativeTime(new Date("2025-01-08T00:00:00Z"), new Date("2025-01-10T00:00:00Z"))).toBe("2 days ago");
    expect(formatSessionDate(new Date("2025-01-08T00:00:00Z"))).toContain("2025");
  });

  it("renders session management controls without basic accessibility violations", async () => {
    const { container } = render(<OwnSessions sessions={[{
      id: "session-1",
      isCurrent: true,
      createdAt: new Date("2025-01-08T00:00:00Z"),
      expiresAt: new Date("2025-02-08T00:00:00Z"),
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36",
    }]} isDevelopment />);

    expect(container).toHaveTextContent("This device (current)");
    expect(container).toHaveTextContent("Chrome on Windows");
    expect(container).toHaveTextContent("This computer (local)");
    expect((await axe(container)).violations).toEqual([]);
  });
});
