import { describe, expect, it } from "vitest";

import {
  bookingStatusUpdateSchema,
  bookingSubmissionSchema,
  manualPaymentSchema,
  quoteRequestSchema,
} from "@/lib/schemas/booking";

describe("Booking and Payment Schemas & Validation", () => {
  it("validates quoteRequestSchema correctly", () => {
    const valid = quoteRequestSchema.safeParse({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      adults: 2,
      children4to10: 1,
      foodPreference: "VEG",
    });
    expect(valid.success).toBe(true);

    // Invalid: checkOut before checkIn
    const invalidDates = quoteRequestSchema.safeParse({
      checkIn: "2026-11-15",
      checkOut: "2026-11-10",
      adults: 2,
    });
    expect(invalidDates.success).toBe(false);

    // Invalid: 0 adults
    const zeroAdults = quoteRequestSchema.safeParse({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      adults: 0,
    });
    expect(zeroAdults.success).toBe(false);
  });

  it("validates bookingSubmissionSchema requiring policy acceptance and idempotency key", () => {
    const valid = bookingSubmissionSchema.safeParse({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      adults: 2,
      contactName: "Sunil Joshi",
      contactPhone: "+91 98215 02956",
      contactEmail: "sunil@example.com",
      policyAccepted: true,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(valid.success).toBe(true);

    // Missing policy acceptance
    const missingPolicy = bookingSubmissionSchema.safeParse({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      adults: 2,
      contactName: "Sunil Joshi",
      contactPhone: "+91 98215 02956",
      policyAccepted: false,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(missingPolicy.success).toBe(false);

    // Non-UUID idempotency key
    const invalidIdempotency = bookingSubmissionSchema.safeParse({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      adults: 2,
      contactName: "Sunil Joshi",
      contactPhone: "+91 98215 02956",
      policyAccepted: true,
      idempotencyKey: "not-a-uuid",
    });
    expect(invalidIdempotency.success).toBe(false);
  });

  it("enforces mandatory cancellation reason when updating status to CANCELLED", () => {
    // Valid: cancellation with reason
    const validCancel = bookingStatusUpdateSchema.safeParse({
      status: "CANCELLED",
      cancelReason: "Guest had a family emergency",
    });
    expect(validCancel.success).toBe(true);

    // Invalid: cancellation without reason
    const invalidCancel = bookingStatusUpdateSchema.safeParse({
      status: "CANCELLED",
    });
    expect(invalidCancel.success).toBe(false);

    // Invalid: empty string reason
    const emptyCancel = bookingStatusUpdateSchema.safeParse({
      status: "CANCELLED",
      cancelReason: "   ",
    });
    expect(emptyCancel.success).toBe(false);

    // Other status does not require cancelReason
    const confirmStatus = bookingStatusUpdateSchema.safeParse({
      status: "CONFIRMED",
    });
    expect(confirmStatus.success).toBe(true);
  });

  it("validates manualPaymentSchema for positive integer paise and allowed methods", () => {
    const validPayment = manualPaymentSchema.safeParse({
      method: "BANK_TRANSFER",
      amountPaise: 500000, // ₹5,000
      reference: "NEFT-1234567890",
      note: "100% advance received via HDFC Bank",
    });
    expect(validPayment.success).toBe(true);

    // Invalid: zero or negative amount
    const zeroAmount = manualPaymentSchema.safeParse({
      method: "CASH",
      amountPaise: 0,
    });
    expect(zeroAmount.success).toBe(false);

    // Invalid: floating point / decimal paise
    const floatAmount = manualPaymentSchema.safeParse({
      method: "UPI",
      amountPaise: 1250.5,
    });
    expect(floatAmount.success).toBe(false);

    // Invalid method
    const invalidMethod = manualPaymentSchema.safeParse({
      method: "BITCOIN",
      amountPaise: 50000,
    });
    expect(invalidMethod.success).toBe(false);
  });
});
