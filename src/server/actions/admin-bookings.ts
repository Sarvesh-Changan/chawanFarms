"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { Prisma } from "@/generated/prisma/client";
import {
  adminBookingFiltersSchema,
  adminManualBookingSchema,
  adminMarkPaymentBouncedSchema,
  adminMarkPaymentClearedSchema,
  adminRecordPaymentSchema,
  adminRecordRefundSchema,
  adminRescheduleBookingSchema,
  adminTransitionStatusSchema,
  adminUpdateBookingNotesSchema,
} from "@/lib/schemas/admin-bookings";
import { can, requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";
import {
  createManualBooking,
  rescheduleBookingDates,
  transitionBookingStatus,
  updateBookingNotes,
} from "@/server/services/booking";
import {
  markPaymentBounced,
  markPaymentCleared,
  recordManualPayment,
  recordRefund,
} from "@/server/services/payments";

async function getClientIp(): Promise<string | undefined> {
  const reqHeaders = await headers();
  return (
    reqHeaders.get("cf-connecting-ip") ??
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

export async function getAdminBookingsAction(rawParams: unknown) {
  await requireStaff();
  await requirePermission("bookings.read");

  const parsed = adminBookingFiltersSchema.safeParse(rawParams);
  if (!parsed.success) {
    return { ok: false, error: "Invalid booking filter parameters." };
  }

  const {
    page,
    pageSize,
    status,
    paymentStatus,
    checkInFrom,
    checkInTo,
    packageSlug,
    search,
    sortBy,
    sortOrder,
  } = parsed.data;

  const where: Prisma.BookingWhereInput = {
    deletedAt: null,
  };

  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;

  if (checkInFrom || checkInTo) {
    where.checkIn = {};
    if (checkInFrom) where.checkIn.gte = new Date(`${checkInFrom}T00:00:00.000Z`);
    if (checkInTo) where.checkIn.lte = new Date(`${checkInTo}T00:00:00.000Z`);
  }

  if (packageSlug) {
    where.package = { slug: packageSlug };
  }

  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { reference: { contains: query, mode: "insensitive" } },
      { contactName: { contains: query, mode: "insensitive" } },
      { contactPhone: { contains: query } },
      { contactEmail: { contains: query, mode: "insensitive" } },
    ];
  }

  const [totalCount, bookings] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        package: { select: { id: true, name: true, slug: true } },
        accommodation: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  return {
    ok: true,
    bookings,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

export async function getAdminBookingDetailAction(bookingId: string) {
  await requireStaff();
  await requirePermission("bookings.read");

  if (!bookingId) {
    return { ok: false, error: "Booking ID is required." };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      lead: true,
      package: true,
      accommodation: true,
      lines: { orderBy: { id: "asc" } },
      payments: { orderBy: { receivedAt: "desc" } },
      policyAcceptances: {
        include: {
          policyVersion: { select: { key: true, version: true, title: true } },
        },
      },
    },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found." };
  }

  const paymentIds = booking.payments.map((p) => p.id);

  // Per Item 8: Booking detail audit timeline shows only Booking-related entries
  const auditLogs = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: "Booking", entityId: booking.id },
        ...(paymentIds.length > 0
          ? [{ entityType: "Payment", entityId: { in: paymentIds } }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    ok: true,
    booking,
    auditLogs,
  };
}

export async function transitionBookingStatusAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("bookings.write");

  const parsed = adminTransitionStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid status transition data." };
  }

  const { bookingId, targetStatus, cancelReason, overridePaymentReason, internalNotes } =
    parsed.data;
  const ip = await getClientIp();

  const hasConfirmOverride = await can(staff, "bookings.confirm");

  const result = await transitionBookingStatus({
    bookingId,
    targetStatus,
    actorId: staff.id,
    actorType: "STAFF",
    cancelReason,
    overridePaymentReason,
    hasConfirmOverridePermission: hasConfirmOverride,
    internalNotes,
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/admin/calendar");
  }

  return result;
}

export async function recordManualPaymentAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("payments.record");

  const parsed = adminRecordPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid payment data." };
  }

  const ip = await getClientIp();

  const result = await recordManualPayment({
    ...parsed.data,
    recordedById: staff.id,
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
  }

  return result;
}

export async function markPaymentClearedAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("payments.record");

  const parsed = adminMarkPaymentClearedSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid payment clearing parameters." };
  }

  const ip = await getClientIp();

  const result = await markPaymentCleared({
    paymentId: parsed.data.paymentId,
    clearedAt: parsed.data.clearedAt,
    actorId: staff.id,
    ip,
  });

  if (result.ok && result.payment) {
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${result.payment.bookingId}`);
  }

  return result;
}

export async function markPaymentBouncedAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("payments.record");

  const parsed = adminMarkPaymentBouncedSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid payment bounced parameters." };
  }

  const ip = await getClientIp();

  const result = await markPaymentBounced({
    paymentId: parsed.data.paymentId,
    bounceReason: parsed.data.bounceReason,
    actorId: staff.id,
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/bookings");
  }

  return result;
}

export async function recordRefundAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("payments.record");

  const parsed = adminRecordRefundSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid refund data." };
  }

  const ip = await getClientIp();

  const result = await recordRefund({
    bookingId: parsed.data.bookingId,
    amountPaise: parsed.data.amountPaise,
    reference: parsed.data.reference,
    note: parsed.data.note,
    actorId: staff.id,
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
  }

  return result;
}

export async function rescheduleBookingDatesAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("bookings.write");
  await requirePermission("availability.write");

  const parsed = adminRescheduleBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid rescheduling data." };
  }

  const ip = await getClientIp();

  const result = await rescheduleBookingDates({
    bookingId: parsed.data.bookingId,
    newCheckIn: parsed.data.newCheckIn,
    newCheckOut: parsed.data.newCheckOut,
    reason: parsed.data.reason,
    actorId: staff.id,
    actorType: "STAFF",
    ip,
  });

  if (result.ok) {
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
    revalidatePath("/admin/availability");
    revalidatePath("/admin/calendar");
  }

  return result;
}

export async function updateBookingNotesAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("bookings.write");

  const parsed = adminUpdateBookingNotesSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid notes data." };
  }

  const ip = await getClientIp();

  const result = await updateBookingNotes({
    bookingId: parsed.data.bookingId,
    internalNotes: parsed.data.internalNotes,
    actorId: staff.id,
    actorType: "STAFF",
    ip,
  });

  if (result.ok) {
    revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
  }

  return result;
}

export async function createManualBookingAction(raw: unknown) {
  const staff = await requireStaff();
  await requirePermission("bookings.write");

  const parsed = adminManualBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid manual booking data." };
  }

  const hasConfirmPermission = await can(staff, "bookings.confirm");
  const ip = await getClientIp();

  const result = await createManualBooking({
    ...parsed.data,
    hasConfirmPermission,
    actorId: staff.id,
    actorType: "STAFF",
    ip,
  });

  if ("ok" in result && !result.ok) {
    return { ok: false as const, error: result.error };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/calendar");

  return { ok: true as const, booking: result };
}
