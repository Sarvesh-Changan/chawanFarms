import "server-only";

import type {
  PaymentEntryStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";

/**
 * Interface definition for future online payment gateways (e.g. Razorpay).
 * In v1, per client Decision D-1, only offline payments are supported.
 */
export interface PaymentProvider {
  name: string;
  createOrder?(params: {
    bookingId: string;
    amountPaise: number;
    currency?: string;
  }): Promise<{ orderId: string; [key: string]: unknown }>;
  verifyWebhook?(
    payload: unknown,
    signature: string,
  ): Promise<{ success: boolean; paymentId?: string; [key: string]: unknown }>;
  refund?(params: {
    paymentId: string;
    amountPaise: number;
    reason: string;
  }): Promise<{ refundId: string; [key: string]: unknown }>;
}

export type RecordPaymentInput = {
  bookingId: string;
  method: PaymentMethod;
  amountPaise: number;
  reference?: string | null;
  receivedAt?: Date | string | null;
  clearedAt?: Date | string | null;
  note?: string | null;
  markCleared?: boolean;
  recordedById?: string | null;
  ip?: string;
};

export type RecordPaymentResult = {
  ok: boolean;
  error?: string;
  payment?: {
    id: string;
    bookingId: string;
    amountPaise: number;
    method: PaymentMethod;
    status: PaymentEntryStatus;
  };
  bookingPaymentStatus?: PaymentStatus;
  amountPaidPaise?: number;
};

/**
 * Records a manual offline payment (Bank Transfer, Cheque, Cash, UPI) for a booking.
 * Decision D-1: Does NOT auto-confirm booking; confirmation is a separate staff action.
 * Cheques default to PENDING. Overpayments exceeding the outstanding balance are rejected.
 */
export async function recordManualPayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  if (input.amountPaise <= 0) {
    return { ok: false, error: "Payment amount must be greater than zero." };
  }

  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      reference: true,
      status: true,
      totalPaise: true,
      amountPaidPaise: true,
      paymentStatus: true,
    },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found." };
  }

  if (booking.status === "CANCELLED" || booking.status === "REJECTED") {
    return {
      ok: false,
      error: `Cannot record payment for a ${booking.status.toLowerCase()} booking.`,
    };
  }

  // Reject overpayments exceeding outstanding balance
  const outstandingPaise = Math.max(0, booking.totalPaise - booking.amountPaidPaise);
  if (input.amountPaise > outstandingPaise) {
    return {
      ok: false,
      error: `Payment amount of ₹${(input.amountPaise / 100).toLocaleString(
        "en-IN",
      )} exceeds the outstanding balance of ₹${(outstandingPaise / 100).toLocaleString(
        "en-IN",
      )}.`,
    };
  }

  // Cheques default to PENDING; other methods default to CLEARED unless markCleared is specified
  const isCleared =
    input.method === "CHEQUE"
      ? (input.markCleared ?? false)
      : (input.markCleared ?? true);

  const paymentEntryStatus: PaymentEntryStatus = isCleared ? "CLEARED" : "PENDING";
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
  const clearedAt = isCleared
    ? input.clearedAt
      ? new Date(input.clearedAt)
      : new Date()
    : null;

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        method: input.method,
        status: paymentEntryStatus,
        amountPaise: input.amountPaise,
        reference: input.reference?.trim() || null,
        receivedAt,
        clearedAt,
        recordedById: input.recordedById || null,
        note: input.note?.trim() || null,
      },
    });

    let newAmountPaidPaise = booking.amountPaidPaise;
    let newBookingPaymentStatus: PaymentStatus = booking.paymentStatus;

    if (isCleared) {
      newAmountPaidPaise = booking.amountPaidPaise + input.amountPaise;
      if (newAmountPaidPaise >= booking.totalPaise) {
        newBookingPaymentStatus = "PAID";
      } else if (newAmountPaidPaise > 0) {
        newBookingPaymentStatus = "PARTIALLY_PAID";
      } else {
        newBookingPaymentStatus = "UNPAID";
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          amountPaidPaise: newAmountPaidPaise,
          paymentStatus: newBookingPaymentStatus,
        },
      });
    }

    await audit({
      actor: input.recordedById ? { id: input.recordedById, type: "STAFF" } : null,
      action: "payment.record_manual",
      entityType: "Payment",
      entityId: payment.id,
      after: {
        bookingReference: booking.reference,
        amountPaise: payment.amountPaise,
        method: payment.method,
        status: payment.status,
        newBookingPaymentStatus,
      },
      ip: input.ip,
    });

    return {
      ok: true,
      payment: {
        id: payment.id,
        bookingId: payment.bookingId,
        amountPaise: payment.amountPaise,
        method: payment.method,
        status: payment.status,
      },
      bookingPaymentStatus: newBookingPaymentStatus,
      amountPaidPaise: newAmountPaidPaise,
    };
  });
}

/**
 * Marks a PENDING payment (e.g. Cheque) as CLEARED.
 * Cleared entries are immutable; once cleared, they cannot be edited.
 */
export async function markPaymentCleared(input: {
  paymentId: string;
  clearedAt?: Date | string | null;
  actorId?: string | null;
  ip?: string;
}): Promise<RecordPaymentResult> {
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: {
      booking: {
        select: {
          id: true,
          reference: true,
          totalPaise: true,
          amountPaidPaise: true,
          paymentStatus: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    return { ok: false, error: "Payment entry not found." };
  }

  if (payment.status !== "PENDING") {
    return {
      ok: false,
      error: `Payment is already ${payment.status}. Cleared entries are immutable.`,
    };
  }

  const booking = payment.booking;
  const outstandingPaise = Math.max(0, booking.totalPaise - booking.amountPaidPaise);
  if (payment.amountPaise > outstandingPaise) {
    return {
      ok: false,
      error: `Clearing this payment would exceed the outstanding booking balance.`,
    };
  }

  const clearedDate = input.clearedAt ? new Date(input.clearedAt) : new Date();

  return db.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CLEARED",
        clearedAt: clearedDate,
      },
    });

    const newAmountPaidPaise = booking.amountPaidPaise + payment.amountPaise;
    const newBookingPaymentStatus: PaymentStatus =
      newAmountPaidPaise >= booking.totalPaise
        ? "PAID"
        : newAmountPaidPaise > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        amountPaidPaise: newAmountPaidPaise,
        paymentStatus: newBookingPaymentStatus,
      },
    });

    await audit({
      actor: input.actorId ? { id: input.actorId, type: "STAFF" } : null,
      action: "payment.mark_cleared",
      entityType: "Payment",
      entityId: payment.id,
      before: { status: "PENDING" },
      after: {
        status: "CLEARED",
        clearedAt: clearedDate,
        newBookingPaymentStatus,
      },
      ip: input.ip,
    });

    return {
      ok: true,
      payment: {
        id: updatedPayment.id,
        bookingId: updatedPayment.bookingId,
        amountPaise: updatedPayment.amountPaise,
        method: updatedPayment.method,
        status: updatedPayment.status,
      },
      bookingPaymentStatus: newBookingPaymentStatus,
      amountPaidPaise: newAmountPaidPaise,
    };
  });
}

/**
 * Marks a PENDING payment (e.g. bounced cheque) as BOUNCED.
 */
export async function markPaymentBounced(input: {
  paymentId: string;
  bounceReason?: string | null;
  actorId?: string | null;
  ip?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
  });

  if (!payment) {
    return { ok: false, error: "Payment entry not found." };
  }

  if (payment.status !== "PENDING") {
    return {
      ok: false,
      error: `Payment is already ${payment.status}. Only pending payments can be marked bounced.`,
    };
  }

  const updatedNote = input.bounceReason
    ? payment.note
      ? `${payment.note} [Bounced: ${input.bounceReason}]`
      : `Bounced: ${input.bounceReason}`
    : payment.note;

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "BOUNCED",
      note: updatedNote,
    },
  });

  await audit({
    actor: input.actorId ? { id: input.actorId, type: "STAFF" } : null,
    action: "payment.mark_bounced",
    entityType: "Payment",
    entityId: payment.id,
    before: { status: "PENDING" },
    after: { status: "BOUNCED", reason: input.bounceReason },
    ip: input.ip,
  });

  return { ok: true };
}

/**
 * Records an offline manual refund.
 * Decision D-2: No automatic refund calculation. Staff enter exact refund amount.
 * Amount must be <= amount currently cleared/paid.
 */
export async function recordRefund(input: {
  bookingId: string;
  amountPaise: number;
  reference?: string | null;
  note?: string | null;
  actorId?: string | null;
  ip?: string;
}): Promise<RecordPaymentResult> {
  if (input.amountPaise <= 0) {
    return { ok: false, error: "Refund amount must be positive." };
  }

  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      reference: true,
      amountPaidPaise: true,
      paymentStatus: true,
    },
  });

  if (!booking) {
    return { ok: false, error: "Booking not found." };
  }

  if (input.amountPaise > booking.amountPaidPaise) {
    return {
      ok: false,
      error: `Refund amount of ₹${(input.amountPaise / 100).toLocaleString(
        "en-IN",
      )} cannot exceed the total amount paid (₹${(
        booking.amountPaidPaise / 100
      ).toLocaleString("en-IN")}).`,
    };
  }

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        method: "BANK_TRANSFER",
        status: "REFUNDED",
        amountPaise: input.amountPaise,
        reference: input.reference?.trim() || null,
        receivedAt: new Date(),
        clearedAt: new Date(),
        recordedById: input.actorId || null,
        note: input.note?.trim() || "Manual refund recorded by staff",
      },
    });

    const newAmountPaidPaise = booking.amountPaidPaise - input.amountPaise;
    const newBookingPaymentStatus: PaymentStatus =
      newAmountPaidPaise === 0 ? "REFUNDED" : "PARTIALLY_REFUNDED";

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        amountPaidPaise: newAmountPaidPaise,
        paymentStatus: newBookingPaymentStatus,
      },
    });

    await audit({
      actor: input.actorId ? { id: input.actorId, type: "STAFF" } : null,
      action: "payment.record_refund",
      entityType: "Payment",
      entityId: payment.id,
      after: {
        refundPaise: input.amountPaise,
        remainingPaidPaise: newAmountPaidPaise,
        newBookingPaymentStatus,
      },
      ip: input.ip,
    });

    return {
      ok: true,
      payment: {
        id: payment.id,
        bookingId: payment.bookingId,
        amountPaise: payment.amountPaise,
        method: payment.method,
        status: payment.status,
      },
      bookingPaymentStatus: newBookingPaymentStatus,
      amountPaidPaise: newAmountPaidPaise,
    };
  });
}
