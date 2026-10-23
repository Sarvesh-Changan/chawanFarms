import { z } from "zod";

export const accountIdSchema = z.string().uuid();

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    city: z.string().trim().max(120).optional().or(z.literal("")),
    marketingConsent: z.boolean(),
  })
  .strict();

export const redeemPointsSchema = z
  .object({
    tierId: accountIdSchema,
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const notificationReadSchema = z
  .object({ notificationId: accountIdSchema })
  .strict();

export const favouriteDeleteSchema = z
  .object({
    entityType: z.enum(["package", "experience", "activity"]),
    entityId: accountIdSchema,
  })
  .strict();

export const deletionRequestSchema = z
  .object({
    reasonText: z.string().trim().max(1_000).optional().or(z.literal("")),
    password: z.string().min(1).max(128).optional(),
  })
  .strict();

export const deletionCancelSchema = z
  .object({ requestId: accountIdSchema })
  .strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
