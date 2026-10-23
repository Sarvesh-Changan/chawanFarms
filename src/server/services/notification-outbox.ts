import "server-only";

import { env } from "@/config/env";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { renderNotificationTemplate } from "@/server/email/notification-templates";
import { sendEmailMessage } from "@/server/integrations/email";
import { getAdminNotificationRecipients, getNotificationTemplateOverrides } from "@/server/services/notifications";

const LEASE_SECONDS = 120;
const DEFAULT_STUCK_THRESHOLD = 10;

export type OutboxProcessSummary = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  stuck: number;
};

function retryDelaySeconds(attempts: number): number {
  return Math.min(86_400, 60 * 2 ** Math.min(Math.max(attempts - 1, 0), 10));
}

function nextDay(): Date {
  return new Date(Date.now() + 86_400_000);
}

function payloadData(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const value = payload as Record<string, unknown>;
  return value.data && typeof value.data === "object" && !Array.isArray(value.data) ? value.data : value;
}

async function claimOutbox(limit: number, now: Date) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "NotificationOutbox"
      WHERE "status" = 'PENDING' AND "sendAfter" <= ${now}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `);
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    await tx.notificationOutbox.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { sendAfter: new Date(now.getTime() + LEASE_SECONDS * 1000), attempts: { increment: 1 } },
    });
    return tx.notificationOutbox.findMany({ where: { id: { in: ids }, status: "PENDING" }, orderBy: { createdAt: "asc" } });
  });
}

async function stuckThreshold(): Promise<number> {
  const setting = await db.setting.findUnique({ where: { key: "notify.stuckThreshold" }, select: { value: true } });
  return typeof setting?.value === "number" && Number.isInteger(setting.value) && setting.value > 0 ? setting.value : DEFAULT_STUCK_THRESHOLD;
}

async function alertIfStuck(count: number): Promise<void> {
  if (count === 0) return;
  const recipients = [...(env.ADMIN_NOTIFY_EMAIL ? [env.ADMIN_NOTIFY_EMAIL] : []), ...(await getAdminNotificationRecipients())];
  if (recipients.length === 0) return;
  const result = await sendEmailMessage({
    type: "notification-outbox-stuck",
    to: [...new Set(recipients)],
    subject: "Notification outbox requires attention",
    html: `<p>There are ${count} notification emails waiting after repeated delivery failures.</p>`,
    text: `There are ${count} notification emails waiting after repeated delivery failures.`,
    transactional: true,
  });
  if (!result.ok) console.warn("[notification-outbox] stuck alert was not sent", { result: result.code });
}

export async function processNotificationOutbox(options: { limit?: number; now?: Date } = {}): Promise<OutboxProcessSummary> {
  const take = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const now = options.now ?? new Date();
  const rows = await claimOutbox(take, now);
  const overrides = await getNotificationTemplateOverrides();
  const summary: OutboxProcessSummary = { claimed: rows.length, sent: 0, retried: 0, failed: 0, stuck: 0 };

  for (const row of rows) {
    let result: Awaited<ReturnType<typeof sendEmailMessage>>;
    try {
      const rendered = await renderNotificationTemplate({ event: row.template, data: payloadData(row.payload), override: overrides[row.template] });
      result = await sendEmailMessage({ type: row.template, to: row.to, subject: rendered.subject, html: rendered.html, text: rendered.text, transactional: rendered.transactional });
    } catch {
      result = { ok: false, code: "TEMPLATE_RENDER_FAILED" };
    }

    if (result.ok) {
      await db.notificationOutbox.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      summary.sent += 1;
      continue;
    }

    const temporary = result.code === "EMAIL_QUOTA_EXCEEDED" || result.code === "EMAIL_QUOTA_UNAVAILABLE" || result.code === "SMTP_TEMPORARY";
    if (temporary) {
      const sendAfter = result.code.startsWith("EMAIL_QUOTA") ? nextDay() : new Date(Date.now() + retryDelaySeconds(row.attempts) * 1000);
      await db.notificationOutbox.updateMany({ where: { id: row.id, status: "PENDING" }, data: { sendAfter, lastError: result.code } });
      summary.retried += 1;
    } else {
      await db.notificationOutbox.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "FAILED", lastError: result.code } });
      summary.failed += 1;
    }
  }

  const threshold = await stuckThreshold();
  const stuck = await db.notificationOutbox.count({ where: { status: "PENDING", attempts: { gte: threshold }, sendAfter: { lte: new Date() } } });
  summary.stuck = stuck;
  if (stuck > 0) await alertIfStuck(stuck);
  return summary;
}

export { retryDelaySeconds };
