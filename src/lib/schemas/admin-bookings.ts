import { z } from "zod";

export const adminBookingFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "ENQUIRY",
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
      "REJECTED",
    ])
    .optional(),
  paymentStatus: z
    .enum(["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED", "PARTIALLY_REFUNDED"])
    .optional(),
  checkInFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkInTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  packageSlug: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["checkIn", "createdAt", "totalPaise", "status"]).default("checkIn"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminBookingFilters = z.infer<typeof adminBookingFiltersSchema>;

export const adminTransitionStatusSchema = z.object({
  bookingId: z.string().uuid(),
  targetStatus: z.enum([
    "ENQUIRY",
    "PENDING_CONFIRMATION",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "REJECTED",
  ]),
  cancelReason: z.string().max(500).optional(),
  overridePaymentReason: z.string().max(500).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export const adminRecordPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum([
    "BANK_TRANSFER",
    "CHEQUE",
    "CASH",
    "UPI",
    "CARD",
    "GATEWAY",
    "OTHER",
  ]),
  amountPaise: z.coerce.number().int().positive("Payment amount must be greater than zero"),
  reference: z.string().max(100).optional(),
  receivedAt: z.string().optional(),
  clearedAt: z.string().optional(),
  note: z.string().max(500).optional(),
  markCleared: z.boolean().optional(),
});

export const adminMarkPaymentClearedSchema = z.object({
  paymentId: z.string().uuid(),
  clearedAt: z.string().optional(),
});

export const adminMarkPaymentBouncedSchema = z.object({
  paymentId: z.string().uuid(),
  bounceReason: z.string().max(500).optional(),
});

export const adminRecordRefundSchema = z.object({
  bookingId: z.string().uuid(),
  amountPaise: z.coerce.number().int().positive("Refund amount must be greater than zero"),
  reference: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

export const adminRescheduleBookingSchema = z.object({
  bookingId: z.string().uuid(),
  newCheckIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date format"),
  newCheckOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date format"),
  reason: z.string().min(1, "A mandatory reason is required to reschedule dates").max(500),
});

export const adminUpdateBookingNotesSchema = z.object({
  bookingId: z.string().uuid(),
  internalNotes: z.string().max(2000, "Notes cannot exceed 2000 characters"),
});

export const adminManualAdjustmentSchema = z.object({
  label: z.string().min(1, "Adjustment label is required").max(100),
  amountPaise: z.number().int("Amount must be in integer paise"),
  reason: z.string().min(1, "Reason is mandatory for manual adjustments").max(500),
});

export const adminManualBookingSchema = z.object({
  contactName: z.string().min(1, "Contact name is required").max(100),
  contactPhone: z.string().min(10, "Valid phone number is required").max(20),
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date format"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date format"),
  adults: z.coerce.number().int().min(1, "At least 1 adult required"),
  children4to10: z.coerce.number().int().min(0).default(0),
  infantsUnder4: z.coerce.number().int().min(0).default(0),
  packageSlug: z.string().optional().nullable(),
  accommodationSlug: z.string().optional().nullable(),
  foodPreference: z.enum(["VEG", "NON_VEG"]).optional().nullable(),
  extras: z
    .array(
      z.object({
        id: z.string(),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
  specialRequests: z.string().max(1000).optional(),
  internalNotes: z.string().max(2000).optional(),
  directConfirm: z.boolean().optional(),
  directConfirmOverrideReason: z.string().max(500).optional(),
  adjustments: z.array(adminManualAdjustmentSchema).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
