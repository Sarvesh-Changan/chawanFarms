"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  adminCalendarQuerySchema,
  adminCreateBlackoutSchema,
  adminToggleBlockSchema,
  adminUpdateCapacitySchema,
} from "@/lib/schemas/admin-availability";
import { requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";
import {
  createBlackoutPeriod,
  getAvailabilityGrid,
  toggleDateBlock,
  updateDateCapacity,
} from "@/server/services/availability";

async function getClientIp(): Promise<string | undefined> {
  const reqHeaders = await headers();
  return (
    reqHeaders.get("cf-connecting-ip") ??
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

export async function getAdminAvailabilityCalendarAction(rawParams: unknown) {
  await requireStaff();
  await requirePermission("bookings.read");

  const parsed = adminCalendarQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return { ok: false, error: "Invalid calendar query parameters." };
  }

  const result = await getAvailabilityGrid({
    accommodationId: parsed.data.accommodationId,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
  });

  return { ok: true, data: result };
}

export async function updateDateCapacityAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("availability.write");

  const parsed = adminUpdateCapacitySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid capacity data." };
  }

  const ip = await getClientIp();

  const result = await updateDateCapacity({
    accommodationId: parsed.data.accommodationId,
    date: parsed.data.date,
    capacity: parsed.data.capacity,
    actorId: staff.id,
    actorType: "STAFF",
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/availability");
  }

  return result;
}

export async function toggleDateBlockAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("availability.write");

  const parsed = adminToggleBlockSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid date block data." };
  }

  const ip = await getClientIp();

  const result = await toggleDateBlock({
    accommodationId: parsed.data.accommodationId,
    date: parsed.data.date,
    isBlocked: parsed.data.isBlocked,
    confirmAffected: parsed.data.confirmAffected,
    actorId: staff.id,
    actorType: "STAFF",
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/availability");
  }

  return result;
}

export async function createBlackoutPeriodAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("availability.write");

  const parsed = adminCreateBlackoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid blackout data." };
  }

  const ip = await getClientIp();

  const result = await createBlackoutPeriod({
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    reason: parsed.data.reason,
    appliesToAll: parsed.data.appliesToAll,
    actorId: staff.id,
    actorType: "STAFF",
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/availability");
  }

  return result;
}

/**
 * Returns arrivals and departures for calendar view (Asia/Kolkata dates, single query without N+1).
 * Day visits (checkIn == checkOut or nights == 0) are correctly flagged.
 */
export async function getAdminCalendarEventsAction(rawParams: unknown) {
  await requireStaff();
  await requirePermission("bookings.read");

  const parsed = adminCalendarQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return { ok: false, error: "Invalid calendar query parameters." };
  }

  const start = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  const end = new Date(`${parsed.data.endDate}T23:59:59.999Z`);

  // Query only visible range
  const bookings = await db.booking.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["CANCELLED", "REJECTED"] },
      OR: [
        { checkIn: { gte: start, lte: end } },
        { checkOut: { gte: start, lte: end } },
      ],
    },
    include: {
      package: { select: { name: true, slug: true } },
      accommodation: { select: { name: true, slug: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const events = bookings.map((b) => {
    const checkInStr = b.checkIn.toISOString().slice(0, 10);
    const checkOutStr = b.checkOut.toISOString().slice(0, 10);
    const isDayVisit = checkInStr === checkOutStr || b.nights === 0;

    return {
      id: b.id,
      reference: b.reference,
      contactName: b.contactName,
      contactPhone: b.contactPhone,
      status: b.status,
      paymentStatus: b.paymentStatus,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      nights: b.nights,
      adults: b.adults,
      children4to10: b.children4to10,
      totalGuests: b.adults + b.children4to10 + b.infantsUnder4,
      isDayVisit,
      packageName: b.package?.name,
      accommodationName: b.accommodation?.name,
    };
  });

  return { ok: true, events };
}
