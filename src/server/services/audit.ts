import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { err, ok, type Result } from "@/lib/result";
import { db } from "@/server/db";

import { redactSensitive } from "./audit-redaction";

export type AuditActor = {
  id?: string | null;
  type?: string;
} | null;

export type AuditInput = {
  actor: AuditActor;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

const auditInputSchema = z
  .object({
    actor: z
      .object({ id: z.string().optional().nullable(), type: z.string().optional() })
      .nullable(),
    action: z.string().trim().min(1).max(120),
    entityType: z.string().trim().min(1).max(80).optional(),
    entityId: z.string().trim().min(1).max(120).optional(),
    before: z.unknown().optional(),
    after: z.unknown().optional(),
    ip: z.string().trim().max(128).optional(),
    userAgent: z.string().trim().max(512).optional(),
    requestId: z.string().trim().max(128).optional(),
  })
  .strict();

function nullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  const safeValue = redactSensitive(value);
  return safeValue === null ? Prisma.JsonNull : (safeValue as Prisma.InputJsonValue);
}

export async function audit(input: AuditInput): Promise<Result<{ id: string }>> {
  const parsed = auditInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION", "Invalid audit event.");
  }

  try {
    const row = await db.auditLog.create({
      data: {
        actorId: parsed.data.actor?.id ?? null,
        actorType: parsed.data.actor?.type ?? "SYSTEM",
        action: parsed.data.action,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        before: parsed.data.before === undefined ? undefined : nullableJson(parsed.data.before),
        after: parsed.data.after === undefined ? undefined : nullableJson(parsed.data.after),
        ip: parsed.data.ip,
        userAgent: parsed.data.userAgent,
        requestId: parsed.data.requestId,
      },
      select: { id: true },
    });

    return ok(row);
  } catch {
    return err("INTERNAL", "The audit event could not be recorded.");
  }
}
