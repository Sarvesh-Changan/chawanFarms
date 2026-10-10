import { z } from "zod";

export const foodPreferenceSchema = z.enum(["VEG", "NON_VEG"]);

export const quoteBaseSchema = z
  .object({
    checkIn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date (YYYY-MM-DD)"),
    checkOut: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date (YYYY-MM-DD)"),
    adults: z.number().int().min(1, "At least 1 adult required").max(100),
    children4to10: z.number().int().min(0).max(100).default(0),
    infantsUnder4: z.number().int().min(0).max(50).default(0),
    packageSlug: z.string().trim().min(1).max(100).optional().nullable(),
    accommodationSlug: z.string().trim().min(1).max(100).optional().nullable(),
    foodPreference: foodPreferenceSchema.optional().nullable(),
    extras: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          quantity: z.number().int().positive().max(50).default(1),
          note: z.string().trim().max(500).optional(),
        }),
      )
      .optional()
      .default([]),
    couponCode: z.string().trim().min(1).max(50).optional().nullable(),
  })
  .strict();

export const quoteRequestSchema = quoteBaseSchema.refine(
  (data) => data.checkOut >= data.checkIn,
  {
    message: "checkOut must be on or after checkIn",
    path: ["checkOut"],
  },
);

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const bookingSubmissionBaseSchema = quoteBaseSchema.extend({
  contactName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120),
  contactPhone: z.string().trim().min(10, "Phone number required").max(20),
  contactEmail: z
    .string()
    .trim()
    .email("Valid email required")
    .max(255)
    .optional()
    .nullable(),
  specialRequests: z.string().trim().max(1000).optional().nullable(),
  policyAccepted: z.literal(true, {
    message: "You must accept the stay rules and policies",
  }),
  policyVersionId: z.string().uuid("Invalid policy version ID").optional().nullable(),
  idempotencyKey: z.string().uuid("idempotencyKey must be a valid UUID"),
});

export const bookingSubmissionSchema = bookingSubmissionBaseSchema
  .strict()
  .refine((data) => data.checkOut >= data.checkIn, {
    message: "checkOut must be on or after checkIn",
    path: ["checkOut"],
  });

export type BookingSubmissionInput = z.infer<typeof bookingSubmissionSchema>;

export const publicBookingActionSchema = bookingSubmissionBaseSchema
  .extend({
    honeypot: z.string().max(0, "Invalid submission").optional().default(""),
    turnstileToken: z.string().trim().max(2048).optional(),
    startedAt: z.number().int().positive(),
  })
  .strict()
  .refine((data) => data.checkOut >= data.checkIn, {
    message: "checkOut must be on or after checkIn",
    path: ["checkOut"],
  });

export type PublicBookingActionInput = z.infer<typeof publicBookingActionSchema>;

export const bookingStatusUpdateSchema = z
  .object({
    status: z.enum([
      "ENQUIRY",
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
      "REJECTED",
    ]),
    cancelReason: z
      .string()
      .trim()
      .min(3, "Cancellation reason required")
      .max(500)
      .optional(),
    internalNotes: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (
        data.status === "CANCELLED" &&
        (!data.cancelReason || data.cancelReason.trim().length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "A cancellation reason is required when cancelling a booking.",
      path: ["cancelReason"],
    },
  );

export type BookingStatusUpdateInput = z.infer<typeof bookingStatusUpdateSchema>;

export const manualPaymentSchema = z
  .object({
    method: z.enum(["BANK_TRANSFER", "CHEQUE", "CASH", "UPI", "OTHER"]),
    amountPaise: z
      .number()
      .int()
      .positive("Payment amount must be positive in paise")
      .max(100_000_000), // Max ₹10,00,000 per payment record
    reference: z.string().trim().max(100).optional().nullable(),
    receivedAt: z.string().datetime().optional().nullable(),
    clearedAt: z.string().datetime().optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
    markCleared: z.boolean().default(true),
  })
  .strict();

export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;
