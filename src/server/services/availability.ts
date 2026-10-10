import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";

export type CheckAvailabilityInput = {
  accommodationId?: string | null;
  accommodationSlug?: string | null;
  checkIn: Date | string;
  checkOut: Date | string;
  unitsRequested?: number | null;
};

export type CheckAvailabilityResult = {
  available: boolean;
  reason?: string;
  unitsRequired: number;
};

export type PlaceHoldInput = {
  bookingId: string;
  accommodationId: string;
  accommodationSlug?: string | null;
  checkIn: Date | string;
  checkOut: Date | string;
  units?: number | null;
  holdHours?: number;
};

/**
 * Normalises a date to UTC midnight Date object (YYYY-MM-DD).
 */
export function normalizeDateOnly(date: Date | string): Date {
  const str = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return new Date(`${str}T00:00:00.000Z`);
}

/**
 * Calculates calendar dates that require inventory.
 * For overnight stays (checkIn < checkOut): returns [checkIn, ..., checkOut - 1 day].
 * For day visits (checkIn == checkOut): returns [checkIn].
 */
export function getStayDates(checkIn: Date | string, checkOut: Date | string): Date[] {
  const start = normalizeDateOnly(checkIn);
  const end = normalizeDateOnly(checkOut);

  if (end < start) {
    throw new Error("checkOut must be on or after checkIn");
  }

  const dates: Date[] = [];
  const current = new Date(start);

  if (start.getTime() === end.getTime()) {
    // Day visit (e.g. picnic)
    dates.push(new Date(start));
    return dates;
  }

  while (current < end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Resolves the unit count for an accommodation.
 * Per Decision D-5 & corrections:
 * - Guest House has unitsTotal = 2 from PDF. A public booking consumes ALL 2 units by default.
 * - Other accommodations: 1 unit or requested count.
 */
export function resolveRequiredUnits(
  accommodationSlug?: string | null,
  unitsRequested?: number | null,
): number {
  if (accommodationSlug === "guest-house") {
    return unitsRequested !== null && unitsRequested !== undefined && unitsRequested > 0
      ? unitsRequested
      : 2; // Default consumes all 2 units
  }
  return unitsRequested !== null && unitsRequested !== undefined && unitsRequested > 0
    ? unitsRequested
    : 1;
}

/**
 * Resolves default total capacity for accommodation.
 * Guest House = 2.
 * Others = 0 (unconstrained; limits via blockouts/holds only per D-5).
 */
export function resolveAccommodationCapacity(accommodationSlug?: string | null): number {
  if (accommodationSlug === "guest-house") {
    return 2;
  }
  return 0; // 0 = unconstrained in database constraint
}

/**
 * Releases expired holds lazily inside a transaction or standalone.
 */
export async function releaseExpiredHoldsInTx(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const now = new Date();

  // Find bookings where hold has expired and status is PENDING_CONFIRMATION
  const expiredBookings = await tx.booking.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      holdExpiresAt: {
        lt: now,
      },
      accommodationId: {
        not: null,
      },
    },
    select: {
      id: true,
      accommodationId: true,
      package: { select: { slug: true } },
      accommodation: { select: { slug: true } },
      checkIn: true,
      checkOut: true,
    },
  });

  if (expiredBookings.length === 0) {
    return 0;
  }

  for (const booking of expiredBookings) {
    if (!booking.accommodationId) continue;
    const dates = getStayDates(booking.checkIn, booking.checkOut);
    const units = resolveRequiredUnits(booking.accommodation?.slug);

    for (const d of dates) {
      await tx.$queryRaw(Prisma.sql`
        UPDATE "AvailabilityDay"
        SET "held" = GREATEST(0, "held" - ${units})
        WHERE "accommodationId" = ${booking.accommodationId}
          AND "date" = ${d}::date
      `);
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        holdExpiresAt: null,
        status: "CANCELLED",
        cancelReason: "Hold expired automatically before confirmation",
        cancelledAt: now,
      },
    });
  }

  return expiredBookings.length;
}

/**
 * Standalone cleanup of expired holds (e.g. for background cron).
 */
export async function cleanupExpiredHolds(): Promise<number> {
  return db.$transaction(async (tx) => {
    return releaseExpiredHoldsInTx(tx);
  });
}

/**
 * Checks whether dates and accommodation are available for booking.
 */
export async function checkAvailability(
  input: CheckAvailabilityInput,
): Promise<CheckAvailabilityResult> {
  const start = normalizeDateOnly(input.checkIn);
  const end = normalizeDateOnly(input.checkOut);
  const dates = getStayDates(start, end);
  const units = resolveRequiredUnits(input.accommodationSlug, input.unitsRequested);

  // 1. Release expired holds lazily
  await cleanupExpiredHolds();

  // 2. Check Blackout Periods
  const blackout = await db.blackoutPeriod.findFirst({
    where: {
      appliesToAll: true,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { reason: true },
  });

  if (blackout) {
    return {
      available: false,
      reason: blackout.reason || "The selected dates fall within a scheduled farm closure period.",
      unitsRequired: units,
    };
  }

  // 3. If no accommodationId specified (e.g. day picnic without overnight room)
  if (!input.accommodationId) {
    return {
      available: true,
      unitsRequired: units,
    };
  }

  // 4. Check AvailabilityDay records
  const existingDays = await db.availabilityDay.findMany({
    where: {
      accommodationId: input.accommodationId,
      date: { in: dates },
    },
  });

  const daysMap = new Map(
    existingDays.map((d) => [d.date.toISOString().slice(0, 10), d]),
  );

  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    const day = daysMap.get(key);

    if (day) {
      if (day.isBlocked) {
        return {
          available: false,
          reason: `Date ${key} is blocked for maintenance or private booking.`,
          unitsRequired: units,
        };
      }

      // If capacity is constrained (> 0, e.g. Guest House = 2)
      if (day.capacity > 0) {
        const availableCapacity = day.capacity - day.booked - day.held;
        if (availableCapacity < units) {
          return {
            available: false,
            reason: `Insufficient capacity on ${key} (requested: ${units}, available: ${Math.max(0, availableCapacity)}).`,
            unitsRequired: units,
          };
        }
      }
    }
  }

  return {
    available: true,
    unitsRequired: units,
  };
}

/**
 * Places a soft hold on accommodation inventory inside a transaction.
 * Uses atomic INSERT ... ON CONFLICT DO NOTHING followed by SELECT ... FOR UPDATE.
 */
export async function placeHold(
  input: PlaceHoldInput,
  tx: Prisma.TransactionClient,
): Promise<{ holdExpiresAt: Date }> {
  // 1. Lazily release expired holds
  await releaseExpiredHoldsInTx(tx);

  const start = normalizeDateOnly(input.checkIn);
  const end = normalizeDateOnly(input.checkOut);
  const dates = getStayDates(start, end);
  const units = resolveRequiredUnits(input.accommodationSlug, input.units);
  const defaultCapacity = resolveAccommodationCapacity(input.accommodationSlug);

  // 2. Fetch holdHours from Setting (seed default 24)
  let holdHours = input.holdHours;
  if (!holdHours) {
    const settingRow = await tx.setting.findUnique({
      where: { key: "booking.holdHours" },
      select: { value: true },
    });
    if (settingRow?.value && typeof settingRow.value === "number") {
      holdHours = settingRow.value;
    } else {
      holdHours = 24; // Default assumption per docs/OPEN_QUESTIONS.md
    }
  }

  // 3. Ensure AvailabilityDay rows exist for each date
  for (const d of dates) {
    await tx.$queryRaw(Prisma.sql`
      INSERT INTO "AvailabilityDay" ("id", "accommodationId", "date", "capacity", "held", "booked", "isBlocked")
      VALUES (${randomUUID()}, ${input.accommodationId}, ${d}::date, ${defaultCapacity}, 0, 0, false)
      ON CONFLICT ("accommodationId", "date") DO NOTHING
    `);
  }

  // 4. Lock each date row with SELECT ... FOR UPDATE and verify capacity
  for (const d of dates) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        capacity: number;
        held: number;
        booked: number;
        isBlocked: boolean;
      }>
    >(Prisma.sql`
      SELECT "id", "capacity", "held", "booked", "isBlocked"
      FROM "AvailabilityDay"
      WHERE "accommodationId" = ${input.accommodationId}
        AND "date" = ${d}::date
      FOR UPDATE
    `);

    const day = rows[0];
    if (!day) {
      throw new Error(`Failed to lock availability row for date ${d.toISOString().slice(0, 10)}.`);
    }

    if (day.isBlocked) {
      throw new Error(`Date ${d.toISOString().slice(0, 10)} is blocked for bookings.`);
    }

    if (day.capacity > 0 && day.capacity - day.booked - day.held < units) {
      throw new Error(
        `Insufficient capacity on ${d.toISOString().slice(0, 10)}: requested ${units}, available ${day.capacity - day.booked - day.held}.`,
      );
    }

    // Increment held counter
    await tx.$queryRaw(Prisma.sql`
      UPDATE "AvailabilityDay"
      SET "held" = "held" + ${units}
      WHERE "id" = ${day.id}
    `);
  }

  const holdExpiresAt = new Date(Date.now() + holdHours * 3600 * 1000);

  // 5. Update booking with holdExpiresAt
  await tx.booking.update({
    where: { id: input.bookingId },
    data: { holdExpiresAt },
  });

  return { holdExpiresAt };
}

/**
 * Confirms a booking inside a transaction, moving held inventory to booked.
 */
export async function confirmBookingAvailability(
  bookingId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      accommodationId: true,
      accommodation: { select: { slug: true } },
      checkIn: true,
      checkOut: true,
      holdExpiresAt: true,
    },
  });

  if (!booking || !booking.accommodationId) return;

  const dates = getStayDates(booking.checkIn, booking.checkOut);
  const units = resolveRequiredUnits(booking.accommodation?.slug);

  for (const d of dates) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        capacity: number;
        held: number;
        booked: number;
        isBlocked: boolean;
      }>
    >(Prisma.sql`
      SELECT "id", "capacity", "held", "booked", "isBlocked"
      FROM "AvailabilityDay"
      WHERE "accommodationId" = ${booking.accommodationId}
        AND "date" = ${d}::date
      FOR UPDATE
    `);

    const day = rows[0];
    if (!day) continue;

    // Convert held to booked: reduce held, increase booked
    await tx.$queryRaw(Prisma.sql`
      UPDATE "AvailabilityDay"
      SET "held" = GREATEST(0, "held" - ${units}),
          "booked" = "booked" + ${units}
      WHERE "id" = ${day.id}
    `);
  }

  await tx.booking.update({
    where: { id: bookingId },
    data: {
      holdExpiresAt: null,
      confirmedAt: new Date(),
    },
  });
}

/**
 * Releases inventory when a booking is cancelled or rejected.
 */
export async function releaseBookingAvailability(
  bookingId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      accommodationId: true,
      accommodation: { select: { slug: true } },
      checkIn: true,
      checkOut: true,
      confirmedAt: true,
    },
  });

  if (!booking || !booking.accommodationId) return;

  const dates = getStayDates(booking.checkIn, booking.checkOut);
  const units = resolveRequiredUnits(booking.accommodation?.slug);
  const wasConfirmed = booking.confirmedAt !== null || booking.status === "CONFIRMED";

  for (const d of dates) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "AvailabilityDay"
      WHERE "accommodationId" = ${booking.accommodationId}
        AND "date" = ${d}::date
      FOR UPDATE
    `);

    const day = rows[0];
    if (!day) continue;

    if (wasConfirmed) {
      // Release from booked
      await tx.$queryRaw(Prisma.sql`
        UPDATE "AvailabilityDay"
        SET "booked" = GREATEST(0, "booked" - ${units})
        WHERE "id" = ${day.id}
      `);
    } else {
      // Release from held
      await tx.$queryRaw(Prisma.sql`
        UPDATE "AvailabilityDay"
        SET "held" = GREATEST(0, "held" - ${units})
        WHERE "id" = ${day.id}
      `);
    }
  }

  await tx.booking.update({
    where: { id: bookingId },
    data: {
      holdExpiresAt: null,
    },
  });
}

/**
 * Updates capacity for an accommodation on a specific date.
 * Refuses setting capacity below currently held + booked units.
 * Audited with before and after.
 */
export async function updateDateCapacity(input: {
  accommodationId: string;
  date: string | Date;
  capacity: number;
  actorId?: string | null;
  actorType?: string;
  ip?: string;
}): Promise<{ ok: boolean; error?: string; day?: { id: string; date: Date; capacity: number } }> {
  if (input.capacity < 0) {
    return { ok: false, error: "Capacity cannot be negative." };
  }

  const targetDate = normalizeDateOnly(input.date);

  return db.$transaction(async (tx) => {
    // Ensure row exists
    await tx.$queryRaw(Prisma.sql`
      INSERT INTO "AvailabilityDay" ("id", "accommodationId", "date", "capacity", "held", "booked", "isBlocked")
      VALUES (${randomUUID()}, ${input.accommodationId}, ${targetDate}::date, ${input.capacity}, 0, 0, false)
      ON CONFLICT ("accommodationId", "date") DO NOTHING
    `);

    const rows = await tx.$queryRaw<
      Array<{ id: string; capacity: number; held: number; booked: number }>
    >(Prisma.sql`
      SELECT "id", "capacity", "held", "booked"
      FROM "AvailabilityDay"
      WHERE "accommodationId" = ${input.accommodationId}
        AND "date" = ${targetDate}::date
      FOR UPDATE
    `);

    const day = rows[0];
    if (!day) {
      return { ok: false, error: "Availability day record not found." };
    }

    const totalOccupied = day.held + day.booked;
    if (input.capacity > 0 && input.capacity < totalOccupied) {
      return {
        ok: false,
        error: `Cannot set capacity to ${input.capacity}, which is below currently held (${day.held}) and booked (${day.booked}) units (${totalOccupied} total).`,
      };
    }

    await tx.$queryRaw(Prisma.sql`
      UPDATE "AvailabilityDay"
      SET "capacity" = ${input.capacity}
      WHERE "id" = ${day.id}
    `);

    await audit({
      actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
      action: "availability.update_capacity",
      entityType: "AvailabilityDay",
      entityId: day.id,
      before: { capacity: day.capacity },
      after: { capacity: input.capacity, date: targetDate.toISOString().slice(0, 10) },
      ip: input.ip,
    });

    return {
      ok: true,
      day: {
        id: day.id,
        date: targetDate,
        capacity: input.capacity,
      },
    };
  });
}

/**
 * Toggles blocked state of a date for an accommodation.
 * If setting isBlocked = true and active CONFIRMED / held bookings exist,
 * returns the affected bookings and requires confirmAffected = true flag.
 */
export async function toggleDateBlock(input: {
  accommodationId: string;
  date: string | Date;
  isBlocked: boolean;
  confirmAffected?: boolean;
  actorId?: string | null;
  actorType?: string;
  ip?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  affectedBookings?: Array<{ id: string; reference: string; contactName: string; status: string }>;
}> {
  const targetDate = normalizeDateOnly(input.date);

  // If blocking, check for active affected bookings
  if (input.isBlocked) {
    const affected = await db.booking.findMany({
      where: {
        accommodationId: input.accommodationId,
        status: { in: ["CONFIRMED", "PENDING_CONFIRMATION"] },
        checkIn: { lte: targetDate },
        OR: [
          { checkOut: { gt: targetDate } },
          { checkIn: targetDate, checkOut: targetDate }, // day visit
        ],
      },
      select: {
        id: true,
        reference: true,
        contactName: true,
        status: true,
      },
    });

    if (affected.length > 0 && !input.confirmAffected) {
      return {
        ok: false,
        requiresConfirmation: true,
        affectedBookings: affected,
        error: `Blocking this date affects ${affected.length} active booking(s). Explicit confirmation required.`,
      };
    }
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      INSERT INTO "AvailabilityDay" ("id", "accommodationId", "date", "capacity", "held", "booked", "isBlocked")
      VALUES (${randomUUID()}, ${input.accommodationId}, ${targetDate}::date, 0, 0, 0, false)
      ON CONFLICT ("accommodationId", "date") DO NOTHING
    `);

    const rows = await tx.$queryRaw<Array<{ id: string; isBlocked: boolean }>>(Prisma.sql`
      SELECT "id", "isBlocked"
      FROM "AvailabilityDay"
      WHERE "accommodationId" = ${input.accommodationId}
        AND "date" = ${targetDate}::date
      FOR UPDATE
    `);

    const day = rows[0];
    if (!day) {
      return { ok: false, error: "Availability day record not found." };
    }

    await tx.$queryRaw(Prisma.sql`
      UPDATE "AvailabilityDay"
      SET "isBlocked" = ${input.isBlocked}
      WHERE "id" = ${day.id}
    `);

    await audit({
      actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
      action: "availability.toggle_block",
      entityType: "AvailabilityDay",
      entityId: day.id,
      before: { isBlocked: day.isBlocked },
      after: { isBlocked: input.isBlocked, date: targetDate.toISOString().slice(0, 10) },
      ip: input.ip,
    });

    return { ok: true };
  });
}

/**
 * Creates a blackout period.
 * Caps blackout duration at 366 days. Audited before/after.
 */
export async function createBlackoutPeriod(input: {
  startDate: string | Date;
  endDate: string | Date;
  reason?: string | null;
  appliesToAll?: boolean;
  actorId?: string | null;
  actorType?: string;
  ip?: string;
}): Promise<{ ok: boolean; error?: string; blackout?: { id: string; startDate: Date; endDate: Date; reason: string | null } }> {
  const start = normalizeDateOnly(input.startDate);
  const end = normalizeDateOnly(input.endDate);

  if (end < start) {
    return { ok: false, error: "End date must be on or after start date." };
  }

  const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (durationDays > 366) {
    return { ok: false, error: "Blackout range cannot exceed 366 days." };
  }

  const blackout = await db.blackoutPeriod.create({
    data: {
      startDate: start,
      endDate: end,
      reason: input.reason?.trim() || null,
      appliesToAll: input.appliesToAll ?? true,
    },
  });

  await audit({
    actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
    action: "availability.create_blackout",
    entityType: "BlackoutPeriod",
    entityId: blackout.id,
    after: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      reason: blackout.reason,
      durationDays,
    },
    ip: input.ip,
  });

  return {
    ok: true,
    blackout: {
      id: blackout.id,
      startDate: blackout.startDate,
      endDate: blackout.endDate,
      reason: blackout.reason,
    },
  };
}

/**
 * Fetches availability grid data for a date range without N+1 queries.
 */
export async function getAvailabilityGrid(input: {
  accommodationId?: string | null;
  startDate: string | Date;
  endDate: string | Date;
}): Promise<{
  days: Array<{
    id: string;
    accommodationId: string;
    date: string;
    capacity: number;
    held: number;
    booked: number;
    isBlocked: boolean;
  }>;
  blackouts: Array<{
    id: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    appliesToAll: boolean;
  }>;
}> {
  const start = normalizeDateOnly(input.startDate);
  const end = normalizeDateOnly(input.endDate);

  const [days, blackouts] = await Promise.all([
    db.availabilityDay.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(input.accommodationId ? { accommodationId: input.accommodationId } : {}),
      },
      orderBy: { date: "asc" },
    }),
    db.blackoutPeriod.findMany({
      where: {
        startDate: { lte: end },
        endDate: { gte: start },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return {
    days: days.map((d) => ({
      id: d.id,
      accommodationId: d.accommodationId,
      date: d.date.toISOString().slice(0, 10),
      capacity: d.capacity,
      held: d.held,
      booked: d.booked,
      isBlocked: d.isBlocked,
    })),
    blackouts: blackouts.map((b) => ({
      id: b.id,
      startDate: b.startDate.toISOString().slice(0, 10),
      endDate: b.endDate.toISOString().slice(0, 10),
      reason: b.reason,
      appliesToAll: b.appliesToAll,
    })),
  };
}

