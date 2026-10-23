import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notificationDataSchema, notificationEventSchema, getNotificationTemplateDefinition, type NotificationEvent } from "@/server/email/notification-templates";

const recipientSchema = z.object({
  userId: z.string().trim().min(1).max(128).optional(),
  email: z.string().trim().max(320).email().optional(),
}).strict().refine((value) => Boolean(value.userId || value.email), "A notification recipient is required.");

const recipientsSchema = z.array(recipientSchema).min(1).max(100);

const toggleSchema = z.record(z.string(), z.boolean());

export type NotificationRecipient = z.input<typeof recipientSchema>;

export type NotifyResult = {
  notificationCount: number;
  outboxCount: number;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function scalarText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function interpolate(value: string, data: Record<string, unknown>): string {
  const values = new Map(Object.entries(data));
  return value.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_match, key: string) => scalarText(values.get(key)));
}

async function notificationSettings() {
  const rows = await db.setting.findMany({
    where: { key: { in: ["notify.toggles", "notify.recipients"] } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const toggles = toggleSchema.safeParse(values.get("notify.toggles"));
  const rawRecipients = values.get("notify.recipients");
  const recipients: string[] = Array.isArray(rawRecipients)
    ? rawRecipients.filter((value: unknown): value is string => typeof value === "string")
    : [];
  return {
    toggles: toggles.success ? toggles.data : {},
    recipients,
  };
}

export async function notify(eventInput: string, recipientsInput: NotificationRecipient[], dataInput: unknown): Promise<NotifyResult> {
  const event = notificationEventSchema.parse(eventInput);
  const recipients = recipientsSchema.parse(recipientsInput);
  const data = notificationDataSchema.parse(dataInput);
  const definition = getNotificationTemplateDefinition(event);
  const settings = await notificationSettings();
  const eventToggle = new Map(Object.entries(settings.toggles)).get(event);
  if (eventToggle === false) return { notificationCount: 0, outboxCount: 0 };

  const resolved = [] as Array<{ userId?: string; email: string; marketingConsent: boolean }>;
  for (const recipient of recipients) {
    if (recipient.userId) {
      const user = await db.user.findUnique({ where: { id: recipient.userId }, select: { id: true, email: true, profile: { select: { marketingConsent: true } } } });
      if (!user) continue;
      resolved.push({ userId: user.id, email: user.email, marketingConsent: user.profile?.marketingConsent ?? false });
    } else if (recipient.email) {
      resolved.push({ email: recipient.email, marketingConsent: false });
    }
  }

  const unique = [...new Map(resolved.map((recipient) => [recipient.userId ?? recipient.email.toLowerCase(), recipient])).values()];
  const notificationTitle = definition.title;
  const notificationBody = interpolate(definition.body, data);
  const link = event.startsWith("BOOKING") ? (typeof data.bookingId === "string" ? `/account/bookings/${encodeURIComponent(data.bookingId)}` : "/account/bookings") : event.startsWith("VIDEO") ? "/account/videos" : event.startsWith("COUPON") || event === "POINTS_EARNED" ? "/account/rewards" : event === "PRE_ARRIVAL_REMINDER" ? (typeof data.bookingId === "string" ? `/account/bookings/${encodeURIComponent(data.bookingId)}` : "/account/bookings") : "/account";
  let notificationCount = 0;
  let outboxCount = 0;

  await db.$transaction(async (tx) => {
    for (const recipient of unique) {
      if (recipient.userId && settings.toggles.inApp !== false) {
        await tx.notification.create({ data: { userId: recipient.userId, type: event, title: notificationTitle, body: notificationBody, link } });
        notificationCount += 1;
      }
      const emailEnabled = settings.toggles.email !== false;
      const consentAllowed = !definition.requiresMarketingConsent || Boolean(recipient.userId && recipient.marketingConsent);
      if (emailEnabled && consentAllowed) {
        await tx.notificationOutbox.create({
          data: {
            channel: "EMAIL",
            to: recipient.email,
            template: event,
            payload: { data, userId: recipient.userId ?? null } as Prisma.InputJsonValue,
          },
        });
        outboxCount += 1;
      }
    }
  });

  return { notificationCount, outboxCount };
}

export async function getAdminNotificationRecipients(): Promise<string[]> {
  const settings = await notificationSettings();
  return [...new Set(settings.recipients)];
}

export async function getNotificationTemplateOverrides(): Promise<Record<string, { subject?: string; body?: string }>> {
  const row = await db.setting.findUnique({ where: { key: "notify.templates" }, select: { value: true } });
  if (typeof row?.value !== "string") return {};
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([key, value]) => {
      const entry = recordValue(value);
      const subject = typeof entry.subject === "string" ? entry.subject : undefined;
      const body = typeof entry.body === "string" ? entry.body : undefined;
      return subject || body ? [[key, { subject, body }]] : [];
    }));
  } catch {
    return {};
  }
}

export function notificationEventIsTransactional(event: NotificationEvent): boolean {
  return getNotificationTemplateDefinition(event).transactional;
}
