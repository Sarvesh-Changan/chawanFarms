import { describe, expect, it, vi } from "vitest";

import { GET as expireCouponsCron } from "@/app/api/cron/expire-coupons/route";
import { isCronRequestAuthorized } from "@/server/cron";
import { renderNotificationTemplate } from "@/server/email/notification-templates";
import { deleteExpiredRateLimitBuckets } from "@/server/jobs/cleanup-rate-limit-buckets";

vi.mock("@/server/jobs/expire-coupons", () => ({ processExpiredCoupons: vi.fn() }));

const deleteMany = vi.hoisted(() => vi.fn().mockResolvedValue({ count: 2 }));
vi.mock("@/server/db", () => ({ db: { rateLimitBucket: { deleteMany } } }));

describe("notifications and cron security", () => {
  it("rejects cron requests when the secret is absent", () => {
    expect(isCronRequestAuthorized(new Request("http://localhost/api/cron/outbox-send"))).toBe(false);
  });

  it("returns 401 from a cron route without its secret", async () => {
    const response = await expireCouponsCron(new Request("http://localhost/api/cron/expire-coupons"));
    expect(response.status).toBe(401);
  });

  it("escapes notification variables in the HTML template", async () => {
    const rendered = await renderNotificationTemplate({ event: "BOOKING_CONFIRMED", data: { name: "<script>alert(1)</script>", reference: "BKG-1", checkIn: "2026-11-01", checkOut: "2026-11-02" } });
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).not.toContain("<script>alert(1)");
  });

  it("deletes only buckets older than the configured expiry cutoff", async () => {
    await expect(deleteExpiredRateLimitBuckets({ olderThanSeconds: 3_600 })).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { windowStart: { lt: expect.any(Date) } } });
  });
});
