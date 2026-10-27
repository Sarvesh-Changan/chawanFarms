import "server-only";

import { db } from "@/server/db";
import { deleteCloudinaryAsset } from "@/server/integrations/cloudinary";
import { notify } from "@/server/services/notifications";

function localDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function localDayRange(offsetDays: number): { start: Date; end: Date } {
  const now = new Date();
  const target = new Date(`${localDate(now)}T00:00:00+05:30`);
  target.setUTCDate(target.getUTCDate() + offsetDays);
  const end = new Date(target);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: target, end };
}

function textFromPolicyBody(value: unknown): string {
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  return typeof record.en === "string" ? record.en.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export async function processLeadReminders(asOf = new Date()): Promise<{ processed: number }> {
  const start = new Date(asOf);
  start.setHours(0, 0, 0, 0);
  const leads = await db.lead.findMany({ where: { followUpAt: { lte: asOf }, assignedToId: { not: null }, status: { not: "CLOSED" } }, select: { id: true, assignedToId: true, email: true, name: true } });
  let processed = 0;
  for (const lead of leads) {
    if (!lead.assignedToId) continue;
    const existing = await db.notification.findFirst({ where: { userId: lead.assignedToId, type: "LEAD_ALERT", link: "/account", body: { contains: lead.id }, createdAt: { gte: start } }, select: { id: true } });
    if (existing) continue;
    await notify("LEAD_ALERT", [{ userId: lead.assignedToId }], { leadId: lead.id, name: lead.name ?? "", email: lead.email ?? "", reference: "Follow-up due", phone: "", message: "A lead follow-up is due." });
    processed += 1;
  }
  return { processed };
}

export async function processPreArrivalReminders(): Promise<{ processed: number }> {
  const { start, end } = localDayRange(1);
  const policy = await db.policyVersion.findFirst({ where: { key: "stay-rules-and-cancellation", status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { version: "desc" }, select: { body: true } });
  const stayRules = textFromPolicyBody(policy?.body);
  if (!stayRules) return { processed: 0 };
  const bookings = await db.booking.findMany({ where: { status: "CONFIRMED", userId: { not: null }, checkIn: { gte: start, lt: end } }, select: { id: true, userId: true, checkIn: true, checkOut: true } });
  let processed = 0;
  for (const booking of bookings) {
    if (!booking.userId) continue;
    const link = `/account/bookings/${encodeURIComponent(booking.id)}`;
    const existing = await db.notification.findFirst({ where: { userId: booking.userId, type: "PRE_ARRIVAL_REMINDER", link, createdAt: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) } }, select: { id: true } });
    if (existing) continue;
    await notify("PRE_ARRIVAL_REMINDER", [{ userId: booking.userId }], { bookingId: booking.id, checkIn: localDate(booking.checkIn), checkOut: localDate(booking.checkOut), stayRules });
    processed += 1;
  }
  return { processed };
}

export async function purgeConfiguredRetention(): Promise<{ auditLogs: number }> {
  const setting = await db.setting.findUnique({ where: { key: "retention.auditDays" }, select: { value: true } });
  if (typeof setting?.value !== "number" || !Number.isInteger(setting.value) || setting.value <= 0) return { auditLogs: 0 };
  const cutoff = new Date(Date.now() - setting.value * 86_400_000);
  const result = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { auditLogs: result.count };
}

export async function reportMediaOrphans(): Promise<{ candidates: number; cleaned: number }> {
  const candidates = await db.media.findMany({ where: { origin: "ADMIN", deletedAt: null, usages: { none: {} }, videoSubmission: null }, select: { id: true, publicId: true, resourceType: true, deliveryType: true, meta: true } });
  let cleaned = 0;
  for (const media of candidates) {
    const meta = media.meta && typeof media.meta === "object" && !Array.isArray(media.meta) ? media.meta as Record<string, unknown> : {};
    const pendingUntil = typeof meta.pendingUntil === "string" ? new Date(meta.pendingUntil) : null;
    if (meta.pending !== true || !pendingUntil || Number.isNaN(pendingUntil.getTime()) || pendingUntil > new Date()) continue;
    const removed = await db.media.updateMany({ where: { id: media.id, deletedAt: null, usages: { none: {} }, videoSubmission: null }, data: { deletedAt: new Date(), isPublic: false } });
    if (!removed.count) continue;
    await deleteCloudinaryAsset({ publicId: media.publicId, resourceType: media.resourceType === "video" ? "video" : "image", deliveryType: media.deliveryType === "authenticated" ? "authenticated" : "upload" });
    cleaned += 1;
  }
  return { candidates: candidates.length, cleaned };
}

export async function reconcileNotificationJob(): Promise<unknown> {
  const { reconcileCustomerPointsBalances } = await import("@/server/jobs/reconcile-points");
  return reconcileCustomerPointsBalances();
}

export async function cleanupExpiredRateLimits(): Promise<{ deleted: number }> {
  const { deleteExpiredRateLimitBuckets } = await import("@/server/jobs/cleanup-rate-limit-buckets");
  return { deleted: await deleteExpiredRateLimitBuckets({ olderThanSeconds: 86_400 }) };
}

