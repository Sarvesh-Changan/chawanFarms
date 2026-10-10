import { z } from "zod";

export const adminUpdateCapacitySchema = z.object({
  accommodationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  capacity: z.coerce.number().int().min(0, "Capacity cannot be negative"),
});

export const adminToggleBlockSchema = z.object({
  accommodationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  isBlocked: z.boolean(),
  confirmAffected: z.boolean().optional(),
});

export const adminCreateBlackoutSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format"),
  reason: z.string().max(500).optional(),
  appliesToAll: z.boolean().default(true),
});

export const adminCalendarQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date"),
  accommodationId: z.string().uuid().optional(),
});
