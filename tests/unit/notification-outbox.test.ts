import { describe, expect, it, vi } from "vitest";

const sendEmailMessage = vi.hoisted(() => vi.fn());
const findUniqueSetting = vi.hoisted(() => vi.fn((args: { where: { key: string } }) => Promise.resolve(args.where.key === "notify.stuckThreshold" ? { value: 10 } : null)));
const updateMany = vi.hoisted(() => vi.fn().mockResolvedValue({ count: 1 }));
const count = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: "outbox-1", channel: "EMAIL", to: "guest@example.com", template: "BOOKING_CONFIRMED", payload: { data: { reference: "BKG-1", name: "Guest", checkIn: "2026-11-01", checkOut: "2026-11-02" } }, status: "PENDING", attempts: 1, lastError: null, sendAfter: new Date(0), sentAt: null, createdAt: new Date(0) }]));
const queryRaw = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: "outbox-1" }]));
const transaction = vi.hoisted(() => vi.fn(async (callback: (tx: unknown) => unknown) => callback({ $queryRaw: queryRaw, notificationOutbox: { updateMany, findMany } })));

vi.mock("@/server/integrations/email", () => ({ sendEmailMessage }));
vi.mock("@/server/services/notifications", () => ({ getAdminNotificationRecipients: vi.fn().mockResolvedValue([]), getNotificationTemplateOverrides: vi.fn().mockResolvedValue({}) }));
vi.mock("@/server/db", () => ({ db: { $transaction: transaction, notificationOutbox: { updateMany, count }, setting: { findUnique: findUniqueSetting } } }));

import { processNotificationOutbox, retryDelaySeconds } from "@/server/services/notification-outbox";

describe("notification outbox", () => {
  it("keeps a row pending and schedules exponential retry on temporary SMTP failure", async () => {
    sendEmailMessage.mockResolvedValue({ ok: false, code: "SMTP_TEMPORARY" });
    const now = new Date("2026-10-21T10:00:00.000Z");
    const result = await processNotificationOutbox({ now, limit: 1 });
    expect(result.retried).toBe(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "outbox-1", status: "PENDING" }, data: expect.objectContaining({ lastError: "SMTP_TEMPORARY" }) }));
    expect(retryDelaySeconds(2)).toBe(120);
  });
});
