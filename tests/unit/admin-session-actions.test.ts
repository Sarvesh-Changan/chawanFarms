import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requirePermission: vi.fn(),
  headers: vi.fn(),
  limit: vi.fn(),
  sessionFindFirst: vi.fn(),
  sessionFindMany: vi.fn(),
  sessionDeleteMany: vi.fn(),
  audit: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/server/auth", () => ({ auth: { api: { signOut: mocks.signOut } }, getSession: mocks.getSession }));
vi.mock("@/server/authz", () => ({ requirePermission: mocks.requirePermission, assertSafeStaffRoleChange: vi.fn() }));
vi.mock("@/server/db", () => ({ db: { session: { findFirst: mocks.sessionFindFirst, findMany: mocks.sessionFindMany, deleteMany: mocks.sessionDeleteMany } } }));
vi.mock("@/server/integrations/ratelimit", () => ({ limit: mocks.limit, limitCapped: vi.fn() }));
vi.mock("@/server/services/audit", () => ({ audit: mocks.audit }));

import { revokeAllOtherSessionsAction, revokeOwnSessionAction } from "@/server/actions/admin-security";
import { listCurrentUserSessions } from "@/server/services/admin-dashboard";

const ownerId = "ca1f38a2-437f-46f2-ae7e-52b3eaf9075f";
const otherSessionId = "00f1eb37-9bb2-40b2-b055-91454ca11b09";
const currentSessionId = "a4f7e5b3-cc15-4381-98a2-13ea72f40eac";
const currentToken = "never-include-this-session-token-in-audit";

describe("admin session revoke actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: ownerId });
    mocks.getSession.mockResolvedValue({ user: { id: ownerId }, session: { id: "current-id", token: currentToken } });
    mocks.headers.mockResolvedValue(new Headers());
    mocks.limit.mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 3600 });
    mocks.audit.mockResolvedValue({ ok: true, data: { id: "audit-id" } });
    mocks.sessionDeleteMany.mockResolvedValue({ count: 2 });
    mocks.signOut.mockResolvedValue({ success: true });
  });

  it("returns 404 when the requested session belongs to another user", async () => {
    mocks.sessionFindFirst.mockResolvedValue(null);

    const result = await revokeOwnSessionAction({ sessionId: otherSessionId });

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(mocks.sessionFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: otherSessionId, userId: ownerId },
    }));
    expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("signs out the current request session and audits without its token", async () => {
    mocks.sessionFindFirst.mockResolvedValue({ id: currentSessionId, token: currentToken });

    const result = await revokeOwnSessionAction({ sessionId: currentSessionId });

    expect(result).toEqual({ ok: true, data: { revoked: true, current: true } });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(currentToken);
  });

  it("marks the request session from database tokens and omits tokens from returned rows", async () => {
    mocks.sessionFindMany.mockResolvedValue([
      { id: "session-current", token: currentToken, createdAt: new Date("2025-01-01"), expiresAt: new Date("2025-02-01"), ipAddress: null, userAgent: null },
      { id: "session-other", token: "other-session-token", createdAt: new Date("2025-01-02"), expiresAt: new Date("2025-02-02"), ipAddress: null, userAgent: null },
    ]);

    const rows = await listCurrentUserSessions(ownerId, currentToken);

    expect(rows.map(({ id, isCurrent }) => ({ id, isCurrent }))).toEqual([
      { id: "session-current", isCurrent: true },
      { id: "session-other", isCurrent: false },
    ]);
    expect(JSON.stringify(rows)).not.toContain(currentToken);
  });

  it("revokes and audits only the current user's other sessions", async () => {
    mocks.sessionFindFirst.mockResolvedValue({ id: "current-id" });

    const result = await revokeAllOtherSessionsAction();

    expect(result).toMatchObject({ ok: true, data: { revoked: 2 } });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: ownerId, id: { not: "current-id" }, expiresAt: { gt: expect.any(Date) } },
    }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.sessions.revoke_others",
      after: { activeOtherSessions: 0 },
    }));
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(currentToken);
    expect(mocks.limit).toHaveBeenCalledWith(`admin:session-revoke:${ownerId}`, 10, 3600);
  });
});
