import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type BookingStatus } from "@/generated/prisma/client";
import { normalizeLeadPhone } from "@/lib/lead-phone";
import { type BookingSubmissionInput } from "@/lib/schemas/booking";
import { db } from "@/server/db";
import {
  sendBookingAcknowledgementEmail,
  sendBookingAdminAlertEmail,
  sendBookingCancelledEmail,
  sendBookingConfirmedEmail,
} from "@/server/integrations/email";
import {
  validateBookingStatusTransition,
} from "@/server/policies/bookingStatus";
import { quote, type RateRow } from "@/server/policies/pricing";
import { audit } from "@/server/services/audit";
import {
  confirmBookingAvailability,
  getStayDates,
  placeHold,
  releaseBookingAvailability,
  resolveAccommodationCapacity,
  resolveRequiredUnits,
} from "@/server/services/availability";

export type BookingResult = {
  id: string;
  reference: string;
  status: BookingStatus;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  nights: number;
  isDuplicate: boolean;
  requiresManualQuote: boolean;
  manualQuoteReason?: string | null;
  holdExpiresAt?: Date | null;
};

/**
 * Generates an atomic, sequential booking reference in format:
 * BKG-YYYY-NNNNNN
 */
async function generateBookingReference(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  try {
    const sequenceRows = await tx.$queryRaw<Array<{ value: bigint }>>(
      Prisma.sql`SELECT nextval('booking_reference_seq') AS value`,
    );
    const seq = Number(sequenceRows[0]?.value);
    return `BKG-${year}-${String(seq).padStart(6, "0")}`;
  } catch {
    // Fallback if sequence is missing in test environment
    const count = await tx.booking.count();
    return `BKG-${year}-${String(count + 1).padStart(6, "0")}`;
  }
}

/**
 * Submits a new booking request.
 * - Re-quotes on server (ignores any client-side prices).
 * - Enforces idempotency via idempotencyKey.
 * - Upserts lead, creates booking, booking lines, policy acceptance, and places hold.
 * - Dispatches emails after transaction commit.
 */
export async function submitBookingRequest(
  input: BookingSubmissionInput,
  options: {
    ip?: string;
    userAgent?: string;
    userId?: string | null;
  } = {},
): Promise<BookingResult> {
  // 1. Idempotency check: if booking with idempotencyKey exists, return it
  if (input.idempotencyKey) {
    const existing = await db.booking.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        id: true,
        reference: true,
        status: true,
        subtotalPaise: true,
        discountPaise: true,
        taxPaise: true,
        totalPaise: true,
        nights: true,
        holdExpiresAt: true,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        reference: existing.reference,
        status: existing.status,
        subtotalPaise: existing.subtotalPaise,
        discountPaise: existing.discountPaise,
        taxPaise: existing.taxPaise,
        totalPaise: existing.totalPaise,
        nights: existing.nights,
        isDuplicate: true,
        requiresManualQuote: existing.status === "ENQUIRY",
        holdExpiresAt: existing.holdExpiresAt,
      };
    }
  }

  // 2. Load Package and active Rate rows from DB
  let packageRecord = null;
  if (input.packageSlug) {
    packageRecord = await db.package.findFirst({
      where: {
        slug: input.packageSlug,
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: { id: true, slug: true },
    });
  }

  // Also resolve accommodation if passed
  let accommodationRecord = null;
  if (input.accommodationSlug) {
    accommodationRecord = await db.accommodation.findFirst({
      where: {
        slug: input.accommodationSlug,
        deletedAt: null,
      },
      select: { id: true, slug: true },
    });
  }

  // Fetch active PackageRate rows for this package
  const dbRates = packageRecord
    ? await db.packageRate.findMany({
        where: {
          packageId: packageRecord.id,
          isActive: true,
        },
      })
    : [];

  const rateCard: RateRow[] = dbRates.map((r) => ({
    id: r.id,
    foodPreference: r.foodPreference as "VEG" | "NON_VEG" | null,
    audience: r.audience,
    unit: r.unit,
    amountPaise: r.amountPaise,
    percentOfAdult: r.percentOfAdult,
    validFrom: r.validFrom,
    validTo: r.validTo,
    isActive: r.isActive,
  }));

  // Fetch tax rate setting (default 0 bps)
  const taxSetting = await db.setting.findUnique({
    where: { key: "booking.taxRateBps" },
    select: { value: true },
  });
  const taxRateBps =
    taxSetting?.value && typeof taxSetting.value === "number"
      ? taxSetting.value
      : 0;

  // 3. Compute quote purely on server
  const quoteResult = quote(
    {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children4to10: input.children4to10,
      infantsUnder4: input.infantsUnder4,
      packageSlug: input.packageSlug,
      foodPreference: input.foodPreference,
      extras: input.extras,
      taxRateBps,
    },
    rateCard,
  );

  // Status is ENQUIRY if below group minimum, otherwise PENDING_CONFIRMATION
  const initialStatus: BookingStatus = quoteResult.requiresManualQuote
    ? "ENQUIRY"
    : "PENDING_CONFIRMATION";

  const phone = normalizeLeadPhone(input.contactPhone);
  const email = input.contactEmail?.trim().toLowerCase() || null;

  // 4. Atomic transaction
  const created = await db.$transaction(
    async (tx) => {
      // (a) Race-safe reference
      const reference = await generateBookingReference(tx);

      // (b) Find or upsert Lead
      const matches = await tx.lead.findMany({
        where: { deletedAt: null, OR: [{ phone }, ...(email ? [{ email }] : [])] },
        orderBy: { createdAt: "asc" },
      });
      const canonicalLead = matches[0];
      let leadId: string;

      if (!canonicalLead) {
        const lead = await tx.lead.create({
          data: {
            name: input.contactName,
            phone,
            email,
            source: "website",
            ...(options.userId ? { userId: options.userId } : {}),
          },
        });
        leadId = lead.id;
      } else {
        leadId = canonicalLead.id;
        await tx.lead.update({
          where: { id: leadId },
          data: {
            name: input.contactName || canonicalLead.name,
            phone,
            email: email ?? canonicalLead.email,
          },
        });
      }

      // Record LeadEvent
      await tx.leadEvent.create({
        data: {
          leadId,
          type: "BOOKING_REQUEST",
          path: "/book",
          meta: {
            bookingReference: reference,
            packageSlug: input.packageSlug,
            status: initialStatus,
          },
        },
      });

      // (c) Policy Version Acceptance
      let policyVersionId = input.policyVersionId;
      if (!policyVersionId) {
        const publishedPolicy = await tx.policyVersion.findFirst({
          where: { key: "stay-rules", status: "PUBLISHED" },
          orderBy: { version: "desc" },
          select: { id: true },
        });
        policyVersionId = publishedPolicy?.id;
      }

      // (d) Create Booking row
      const booking = await tx.booking.create({
        data: {
          reference,
          leadId,
          userId: options.userId ?? null,
          status: initialStatus,
          paymentStatus: "UNPAID",
          packageId: packageRecord?.id ?? null,
          accommodationId: accommodationRecord?.id ?? null,
          checkIn: new Date(`${input.checkIn}T00:00:00.000Z`),
          checkOut: new Date(`${input.checkOut}T00:00:00.000Z`),
          nights: quoteResult.nights,
          adults: input.adults,
          children4to10: input.children4to10 ?? 0,
          infantsUnder4: input.infantsUnder4 ?? 0,
          foodPreference: input.foodPreference ?? null,
          specialRequests: input.specialRequests ?? null,
          contactName: input.contactName,
          contactPhone: phone,
          contactEmail: email,
          subtotalPaise: quoteResult.subtotalPaise,
          discountPaise: quoteResult.discountPaise,
          taxPaise: quoteResult.taxPaise,
          totalPaise: quoteResult.totalPaise,
          pricingSnapshot: quoteResult.snapshot as unknown as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
          lines: {
            create: quoteResult.lines.map((l) => ({
              kind: l.kind,
              label: l.label,
              quantity: l.quantity,
              unitPaise: l.unitPaise,
              totalPaise: l.totalPaise,
              meta: l.meta as Prisma.InputJsonValue | undefined,
            })),
          },
          ...(policyVersionId
            ? {
                policyAcceptances: {
                  create: {
                    policyVersionId,
                    ip: options.ip ?? null,
                  },
                },
              }
            : {}),
        },
      });

      // (e) Place hold if accommodation is specified and quote was standard
      let holdExpiresAt: Date | null = null;
      if (accommodationRecord && !quoteResult.requiresManualQuote) {
        const holdRes = await placeHold(
          {
            bookingId: booking.id,
            accommodationId: accommodationRecord.id,
            accommodationSlug: accommodationRecord.slug,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
          },
          tx,
        );
        holdExpiresAt = holdRes.holdExpiresAt;
      }

      // (f) Audit log
      await audit({
        actor: options.userId ? { id: options.userId, type: "CUSTOMER" } : null,
        action: "booking.create",
        entityType: "Booking",
        entityId: booking.id,
        after: {
          reference: booking.reference,
          totalPaise: booking.totalPaise,
          status: booking.status,
        },
        ip: options.ip,
        userAgent: options.userAgent,
      });

      return {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        subtotalPaise: booking.subtotalPaise,
        discountPaise: booking.discountPaise,
        taxPaise: booking.taxPaise,
        totalPaise: booking.totalPaise,
        nights: booking.nights,
        isDuplicate: false,
        requiresManualQuote: quoteResult.requiresManualQuote,
        manualQuoteReason: quoteResult.manualQuoteReason,
        holdExpiresAt,
      };
    },
    { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 },
  );

  // 5. Send emails AFTER transaction commit
  try {
    if (email) {
      await sendBookingAcknowledgementEmail({
        to: email,
        name: input.contactName,
        reference: created.reference,
        totalPaise: created.totalPaise,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        status: created.status,
      });
    }

    // Admin alert email
    const adminEmailSetting = await db.setting.findUnique({
      where: { key: "business.email" },
      select: { value: true },
    });
    const adminEmail =
      adminEmailSetting?.value && typeof adminEmailSetting.value === "string"
        ? adminEmailSetting.value
        : "reservations@chawanfarms.com";

    await sendBookingAdminAlertEmail({
      to: adminEmail,
      name: input.contactName,
      phone,
      reference: created.reference,
      totalPaise: created.totalPaise,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      status: created.status,
    });
  } catch (emailErr) {
    // Do not fail the booking if email delivery encounters a network error
    console.warn("Failed to dispatch booking notification emails:", emailErr);
  }

  return created;
}

/**
 * Transitions booking status according to the strict state machine.
 * Race-safe via updateMany precondition on current status.
 * Requires paymentStatus = PAID for CONFIRMED, unless actor has bookings.confirm + overrideReason.
 */
export async function transitionBookingStatus(input: {
  bookingId: string;
  targetStatus: BookingStatus;
  actorId?: string | null;
  actorType?: string;
  cancelReason?: string | null;
  overridePaymentReason?: string | null;
  hasConfirmOverridePermission?: boolean;
  internalNotes?: string | null;
  ip?: string;
}): Promise<
  | { ok: true; booking: { id: string; reference: string; status: BookingStatus } }
  | { ok: false; error: string }
> {
  const current = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      reference: true,
      status: true,
      paymentStatus: true,
      totalPaise: true,
      amountPaidPaise: true,
      contactName: true,
      contactEmail: true,
      checkIn: true,
      checkOut: true,
      accommodationId: true,
      confirmedAt: true,
    },
  });

  if (!current) {
    return { ok: false, error: "Booking not found." };
  }

  const validation = validateBookingStatusTransition(current.status, input.targetStatus);
  if (!validation.valid) {
    await audit({
      actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
      action: "booking.status_transition_rejected",
      entityType: "Booking",
      entityId: current.id,
      before: { status: current.status },
      after: { attemptedStatus: input.targetStatus, reason: validation.reason },
      ip: input.ip,
    });
    return { ok: false, error: validation.reason };
  }

  // Precondition: Confirmation requires paymentStatus = PAID unless actor has bookings.confirm AND overridePaymentReason
  if (input.targetStatus === "CONFIRMED") {
    if (current.paymentStatus !== "PAID") {
      if (!input.hasConfirmOverridePermission) {
        return {
          ok: false,
          error: "Booking cannot be confirmed until payment status is PAID.",
        };
      }
      if (!input.overridePaymentReason?.trim()) {
        return {
          ok: false,
          error: "An override reason is required to confirm a booking with outstanding payment.",
        };
      }
    }
  }

  if (input.targetStatus === "CANCELLED" && !input.cancelReason?.trim()) {
    return {
      ok: false,
      error: "A mandatory cancellation reason is required.",
    };
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      if (input.targetStatus === "CONFIRMED") {
        await confirmBookingAvailability(current.id, tx);
        const updateCount = await tx.booking.updateMany({
          where: { id: current.id, status: current.status },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            internalNotes: input.internalNotes ?? undefined,
          },
        });
        if (updateCount.count === 0) {
          throw new Error("Concurrent update conflict: booking status was modified by another operation.");
        }
      } else if (input.targetStatus === "CANCELLED") {
        await releaseBookingAvailability(current.id, tx);
        const updateCount = await tx.booking.updateMany({
          where: { id: current.id, status: current.status },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: input.cancelReason || "Cancelled by staff",
            internalNotes: input.internalNotes ?? undefined,
          },
        });
        if (updateCount.count === 0) {
          throw new Error("Concurrent update conflict: booking status was modified by another operation.");
        }
      } else if (input.targetStatus === "REJECTED") {
        await releaseBookingAvailability(current.id, tx);
        const updateCount = await tx.booking.updateMany({
          where: { id: current.id, status: current.status },
          data: {
            status: "REJECTED",
            cancelReason: input.cancelReason || "Rejected by staff",
            internalNotes: input.internalNotes ?? undefined,
          },
        });
        if (updateCount.count === 0) {
          throw new Error("Concurrent update conflict: booking status was modified by another operation.");
        }
      } else {
        const updateCount = await tx.booking.updateMany({
          where: { id: current.id, status: current.status },
          data: {
            status: input.targetStatus,
            internalNotes: input.internalNotes ?? undefined,
          },
        });
        if (updateCount.count === 0) {
          throw new Error("Concurrent update conflict: booking status was modified by another operation.");
        }
      }

      return {
        id: current.id,
        reference: current.reference,
        status: input.targetStatus,
      };
    });

    await audit({
      actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
      action: "booking.status_change",
      entityType: "Booking",
      entityId: current.id,
      before: { status: current.status },
      after: {
        status: updated.status,
        cancelReason: input.cancelReason,
        overridePaymentReason: input.overridePaymentReason,
      },
      ip: input.ip,
    });

    // Send emails post-commit (errors logged, never blocking)
    if (updated.status === "CONFIRMED" && current.contactEmail) {
      try {
        await sendBookingConfirmedEmail({
          to: current.contactEmail,
          name: current.contactName,
          reference: current.reference,
          checkIn: current.checkIn.toISOString().slice(0, 10),
          checkOut: current.checkOut.toISOString().slice(0, 10),
        });
      } catch (err) {
        console.warn("Failed to dispatch booking confirmed email:", err);
      }
    } else if (updated.status === "CANCELLED" && current.contactEmail) {
      try {
        await sendBookingCancelledEmail({
          to: current.contactEmail,
          name: current.contactName,
          reference: current.reference,
          reason: input.cancelReason || "Cancelled by staff",
        });
      } catch (err) {
        console.warn("Failed to dispatch booking cancelled email:", err);
      }
    }

    return {
      ok: true,
      booking: updated,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to transition booking status.",
    };
  }
}

/**
 * Reschedules booking dates by safely releasing old inventory and placing new inventory
 * in ONE locked transaction. Requires mandatory reason and logs audit before/after.
 */
export async function rescheduleBookingDates(input: {
  bookingId: string;
  newCheckIn: string;
  newCheckOut: string;
  reason: string;
  actorId?: string | null;
  actorType?: string;
  ip?: string;
}): Promise<
  | { ok: true; booking: { id: string; checkIn: Date; checkOut: Date; nights: number } }
  | { ok: false; error: string }
> {
  if (!input.reason?.trim()) {
    return { ok: false, error: "A mandatory reason is required to reschedule booking dates." };
  }

  const current = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      accommodation: { select: { slug: true } },
    },
  });

  if (!current) {
    return { ok: false, error: "Booking not found." };
  }

  if (["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(current.status)) {
    return { ok: false, error: `Cannot reschedule a ${current.status.toLowerCase()} booking.` };
  }

  const newStart = new Date(`${input.newCheckIn}T00:00:00.000Z`);
  const newEnd = new Date(`${input.newCheckOut}T00:00:00.000Z`);
  if (newEnd < newStart) {
    return { ok: false, error: "Check-out date must be on or after check-in date." };
  }

  const oldDates = getStayDates(current.checkIn, current.checkOut);
  const newDates = getStayDates(newStart, newEnd);
  const units = resolveRequiredUnits(current.accommodation?.slug);
  const defaultCapacity = resolveAccommodationCapacity(current.accommodation?.slug);
  const isConfirmed = current.status === "CONFIRMED";

  try {
    const updated = await db.$transaction(async (tx) => {
      if (current.accommodationId) {
        // 1. Release old inventory
        for (const d of oldDates) {
          const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id"
            FROM "AvailabilityDay"
            WHERE "accommodationId" = ${current.accommodationId}
              AND "date" = ${d}::date
            FOR UPDATE
          `);
          const day = rows[0];
          if (day) {
            if (isConfirmed) {
              await tx.$queryRaw(Prisma.sql`
                UPDATE "AvailabilityDay"
                SET "booked" = GREATEST(0, "booked" - ${units})
                WHERE "id" = ${day.id}
              `);
            } else {
              await tx.$queryRaw(Prisma.sql`
                UPDATE "AvailabilityDay"
                SET "held" = GREATEST(0, "held" - ${units})
                WHERE "id" = ${day.id}
              `);
            }
          }
        }

        // 2. Ensure new rows exist
        for (const d of newDates) {
          await tx.$queryRaw(Prisma.sql`
            INSERT INTO "AvailabilityDay" ("id", "accommodationId", "date", "capacity", "held", "booked", "isBlocked")
            VALUES (${randomUUID()}, ${current.accommodationId}, ${d}::date, ${defaultCapacity}, 0, 0, false)
            ON CONFLICT ("accommodationId", "date") DO NOTHING
          `);
        }

        // 3. Lock new rows and verify capacity
        for (const d of newDates) {
          const rows = await tx.$queryRaw<
            Array<{ id: string; capacity: number; held: number; booked: number; isBlocked: boolean }>
          >(Prisma.sql`
            SELECT "id", "capacity", "held", "booked", "isBlocked"
            FROM "AvailabilityDay"
            WHERE "accommodationId" = ${current.accommodationId}
              AND "date" = ${d}::date
            FOR UPDATE
          `);
          const day = rows[0];
          if (!day) {
            throw new Error(`Failed to lock date ${d.toISOString().slice(0, 10)}.`);
          }
          if (day.isBlocked) {
            throw new Error(`Date ${d.toISOString().slice(0, 10)} is blocked.`);
          }
          if (day.capacity > 0 && day.capacity - day.booked - day.held < units) {
            throw new Error(
              `Insufficient capacity on ${d.toISOString().slice(0, 10)}: requested ${units}, available ${
                day.capacity - day.booked - day.held
              }.`,
            );
          }

          if (isConfirmed) {
            await tx.$queryRaw(Prisma.sql`
              UPDATE "AvailabilityDay"
              SET "booked" = "booked" + ${units}
              WHERE "id" = ${day.id}
            `);
          } else {
            await tx.$queryRaw(Prisma.sql`
              UPDATE "AvailabilityDay"
              SET "held" = "held" + ${units}
              WHERE "id" = ${day.id}
            `);
          }
        }
      }

      const nights =
        input.newCheckIn === input.newCheckOut
          ? 0
          : Math.round((newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24));

      return tx.booking.update({
        where: { id: current.id },
        data: {
          checkIn: newStart,
          checkOut: newEnd,
          nights,
        },
      });
    });

    await audit({
      actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
      action: "booking.reschedule_dates",
      entityType: "Booking",
      entityId: current.id,
      before: {
        checkIn: current.checkIn.toISOString().slice(0, 10),
        checkOut: current.checkOut.toISOString().slice(0, 10),
        nights: current.nights,
      },
      after: {
        checkIn: input.newCheckIn,
        checkOut: input.newCheckOut,
        nights: updated.nights,
        reason: input.reason,
      },
      ip: input.ip,
    });

    return {
      ok: true,
      booking: {
        id: updated.id,
        checkIn: updated.checkIn,
        checkOut: updated.checkOut,
        nights: updated.nights,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reschedule booking dates.",
    };
  }
}

export type ManualAdjustmentLine = {
  label: string;
  amountPaise: number;
  reason: string;
};

export type CreateManualBookingInput = {
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children4to10?: number;
  infantsUnder4?: number;
  packageSlug?: string | null;
  accommodationSlug?: string | null;
  foodPreference?: "VEG" | "NON_VEG" | null;
  extras?: Array<{ id: string; quantity: number }>;
  specialRequests?: string | null;
  internalNotes?: string | null;
  adjustments?: ManualAdjustmentLine[];
  directConfirm?: boolean;
  directConfirmOverrideReason?: string | null;
  hasConfirmPermission?: boolean;
  idempotencyKey?: string | null;
  actorId?: string | null;
  actorType?: string;
  ip?: string;
  userAgent?: string;
};

/**
 * Creates a manual booking (Phone/WhatsApp) using the quote() engine.
 * Allows priced adjustment lines only for actors with `bookings.confirm` permission.
 * Gated by direct confirmation payment rules.
 */
export async function createManualBooking(
  input: CreateManualBookingInput,
): Promise<BookingResult | { ok: false; error: string }> {
  // 1. Idempotency check
  if (input.idempotencyKey) {
    const existing = await db.booking.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        id: true,
        reference: true,
        status: true,
        subtotalPaise: true,
        discountPaise: true,
        taxPaise: true,
        totalPaise: true,
        nights: true,
        holdExpiresAt: true,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        reference: existing.reference,
        status: existing.status,
        subtotalPaise: existing.subtotalPaise,
        discountPaise: existing.discountPaise,
        taxPaise: existing.taxPaise,
        totalPaise: existing.totalPaise,
        nights: existing.nights,
        isDuplicate: true,
        requiresManualQuote: existing.status === "ENQUIRY",
        holdExpiresAt: existing.holdExpiresAt,
      };
    }
  }

  // 2. Validate price adjustments
  if (input.adjustments && input.adjustments.length > 0) {
    if (!input.hasConfirmPermission) {
      return {
        ok: false,
        error: "Only staff with 'bookings.confirm' permission can add priced adjustment lines.",
      };
    }
    for (const adj of input.adjustments) {
      if (!adj.label?.trim() || !adj.reason?.trim()) {
        return {
          ok: false,
          error: "All adjustment lines must have a valid label and a mandatory reason.",
        };
      }
    }
  }

  // 3. Direct confirmation rule check
  if (input.directConfirm) {
    if (!input.hasConfirmPermission) {
      return {
        ok: false,
        error: "Direct confirmation of an unpaid booking requires 'bookings.confirm' permission.",
      };
    }
    if (!input.directConfirmOverrideReason?.trim()) {
      return {
        ok: false,
        error: "An override reason is required to directly confirm an unpaid booking.",
      };
    }
  }

  // 4. Load Package & Rates
  let packageRecord = null;
  if (input.packageSlug) {
    packageRecord = await db.package.findFirst({
      where: { slug: input.packageSlug, status: "PUBLISHED", deletedAt: null },
      select: { id: true, slug: true },
    });
  }

  let accommodationRecord = null;
  if (input.accommodationSlug) {
    accommodationRecord = await db.accommodation.findFirst({
      where: { slug: input.accommodationSlug, deletedAt: null },
      select: { id: true, slug: true },
    });
  }

  const dbRates = packageRecord
    ? await db.packageRate.findMany({
        where: { packageId: packageRecord.id, isActive: true },
      })
    : [];

  const rateCard: RateRow[] = dbRates.map((r) => ({
    id: r.id,
    foodPreference: r.foodPreference as "VEG" | "NON_VEG" | null,
    audience: r.audience,
    unit: r.unit,
    amountPaise: r.amountPaise,
    percentOfAdult: r.percentOfAdult,
    validFrom: r.validFrom,
    validTo: r.validTo,
    isActive: r.isActive,
  }));

  const quoteResult = quote(
    {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children4to10: input.children4to10,
      infantsUnder4: input.infantsUnder4,
      packageSlug: input.packageSlug,
      foodPreference: input.foodPreference,
      extras: input.extras?.map((e) => ({ name: e.id, quantity: e.quantity })),
      taxRateBps: 0,
    },
    rateCard,
  );

  let additionalPaise = 0;
  const extraLines = (input.adjustments || []).map((adj) => {
    additionalPaise += adj.amountPaise;
    return {
      kind: adj.amountPaise >= 0 ? "EXTRA" : "DISCOUNT",
      label: adj.label,
      quantity: 1,
      unitPaise: adj.amountPaise,
      totalPaise: adj.amountPaise,
      meta: {
        reason: adj.reason,
        actorId: input.actorId,
        manualAdjustment: true,
      } as Prisma.InputJsonValue,
    };
  });

  const finalTotalPaise = Math.max(0, quoteResult.totalPaise + additionalPaise);
  const initialStatus: BookingStatus = input.directConfirm
    ? "CONFIRMED"
    : quoteResult.requiresManualQuote
    ? "ENQUIRY"
    : "PENDING_CONFIRMATION";

  const phone = normalizeLeadPhone(input.contactPhone);
  const email = input.contactEmail?.trim().toLowerCase() || null;

  try {
    const created = await db.$transaction(async (tx) => {
      const reference = await generateBookingReference(tx);

      // Lead upsert
      const matches = await tx.lead.findMany({
        where: { deletedAt: null, OR: [{ phone }, ...(email ? [{ email }] : [])] },
        orderBy: { createdAt: "asc" },
      });
      const canonicalLead = matches[0];
      let leadId: string;

      if (!canonicalLead) {
        const lead = await tx.lead.create({
          data: {
            name: input.contactName,
            phone,
            email,
            source: "manual",
          },
        });
        leadId = lead.id;
      } else {
        leadId = canonicalLead.id;
        await tx.lead.update({
          where: { id: leadId },
          data: {
            name: input.contactName || canonicalLead.name,
            phone,
            email: email ?? canonicalLead.email,
          },
        });
      }

      await tx.leadEvent.create({
        data: {
          leadId,
          type: "MANUAL_BOOKING_CREATED",
          path: "/admin/bookings/new",
          meta: {
            bookingReference: reference,
            actorId: input.actorId,
            status: initialStatus,
          },
        },
      });

      const booking = await tx.booking.create({
        data: {
          reference,
          leadId,
          createdById: input.actorId || null,
          status: initialStatus,
          paymentStatus: "UNPAID",
          packageId: packageRecord?.id ?? null,
          accommodationId: accommodationRecord?.id ?? null,
          checkIn: new Date(`${input.checkIn}T00:00:00.000Z`),
          checkOut: new Date(`${input.checkOut}T00:00:00.000Z`),
          nights: quoteResult.nights,
          adults: input.adults,
          children4to10: input.children4to10 ?? 0,
          infantsUnder4: input.infantsUnder4 ?? 0,
          foodPreference: input.foodPreference ?? null,
          specialRequests: input.specialRequests ?? null,
          internalNotes: input.internalNotes ?? null,
          contactName: input.contactName,
          contactPhone: phone,
          contactEmail: email,
          subtotalPaise: quoteResult.subtotalPaise,
          discountPaise: quoteResult.discountPaise,
          taxPaise: quoteResult.taxPaise,
          totalPaise: finalTotalPaise,
          pricingSnapshot: {
            ...quoteResult.snapshot,
            manualAdjustments: input.adjustments ?? [],
          } as unknown as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
          confirmedAt: input.directConfirm ? new Date() : null,
          lines: {
            create: [
              ...quoteResult.lines.map((l) => ({
                kind: l.kind,
                label: l.label,
                quantity: l.quantity,
                unitPaise: l.unitPaise,
                totalPaise: l.totalPaise,
                meta: l.meta as Prisma.InputJsonValue | undefined,
              })),
              ...extraLines,
            ],
          },
        },
      });

      let holdExpiresAt: Date | null = null;
      if (accommodationRecord) {
        if (input.directConfirm) {
          const dates = getStayDates(booking.checkIn, booking.checkOut);
          const units = resolveRequiredUnits(accommodationRecord.slug);
          const defaultCapacity = resolveAccommodationCapacity(accommodationRecord.slug);

          for (const d of dates) {
            await tx.$queryRaw(Prisma.sql`
              INSERT INTO "AvailabilityDay" ("id", "accommodationId", "date", "capacity", "held", "booked", "isBlocked")
              VALUES (${randomUUID()}, ${accommodationRecord.id}, ${d}::date, ${defaultCapacity}, 0, 0, false)
              ON CONFLICT ("accommodationId", "date") DO NOTHING
            `);
            const rows = await tx.$queryRaw<Array<{ id: string; capacity: number; held: number; booked: number; isBlocked: boolean }>>(Prisma.sql`
              SELECT "id", "capacity", "held", "booked", "isBlocked"
              FROM "AvailabilityDay"
              WHERE "accommodationId" = ${accommodationRecord.id}
                AND "date" = ${d}::date
              FOR UPDATE
            `);
            const day = rows[0];
            if (day) {
              if (day.capacity > 0 && day.capacity - day.booked - day.held < units) {
                throw new Error(`Insufficient capacity on date ${d.toISOString().slice(0, 10)}.`);
              }
              await tx.$queryRaw(Prisma.sql`
                UPDATE "AvailabilityDay"
                SET "booked" = "booked" + ${units}
                WHERE "id" = ${day.id}
              `);
            }
          }
        } else if (!quoteResult.requiresManualQuote) {
          const holdRes = await placeHold(
            {
              bookingId: booking.id,
              accommodationId: accommodationRecord.id,
              accommodationSlug: accommodationRecord.slug,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
            },
            tx,
          );
          holdExpiresAt = holdRes.holdExpiresAt;
        }
      }

      await audit({
        actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
        action: "booking.create_manual",
        entityType: "Booking",
        entityId: booking.id,
        after: {
          reference: booking.reference,
          totalPaise: booking.totalPaise,
          status: booking.status,
          adjustments: input.adjustments ?? [],
          directConfirmOverrideReason: input.directConfirmOverrideReason,
        },
        ip: input.ip,
        userAgent: input.userAgent,
      });

      return {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        subtotalPaise: booking.subtotalPaise,
        discountPaise: booking.discountPaise,
        taxPaise: booking.taxPaise,
        totalPaise: booking.totalPaise,
        nights: booking.nights,
        isDuplicate: false,
        requiresManualQuote: quoteResult.requiresManualQuote,
        manualQuoteReason: quoteResult.manualQuoteReason,
        holdExpiresAt,
      };
    });

    return created;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create manual booking.",
    };
  }
}

/**
 * Updates internal notes on a booking. Plain text, max length 2000 chars, audited.
 */
export async function updateBookingNotes(input: {
  bookingId: string;
  internalNotes: string;
  actorId?: string | null;
  actorType?: string;
  ip?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const current = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, internalNotes: true },
  });

  if (!current) {
    return { ok: false, error: "Booking not found." };
  }

  const sanitizedNotes = input.internalNotes.slice(0, 2000);

  await db.booking.update({
    where: { id: current.id },
    data: { internalNotes: sanitizedNotes },
  });

  await audit({
    actor: input.actorId ? { id: input.actorId, type: input.actorType ?? "STAFF" } : null,
    action: "booking.update_notes",
    entityType: "Booking",
    entityId: current.id,
    before: { internalNotes: current.internalNotes },
    after: { internalNotes: sanitizedNotes },
    ip: input.ip,
  });

  return { ok: true };
}

