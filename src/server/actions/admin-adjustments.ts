"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { maskEmail } from "@/lib/mask";
import { err, ok, type Result } from "@/lib/result";
import { requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import {
  adjustPoints,
  approveAdjustment,
  getActiveRewardRuleWithTiers,
  rejectAdjustment,
} from "@/server/services/rewards";

const searchCustomerSchema = z
  .object({
    query: z.string().trim().min(3, "Search requires at least 3 characters").max(100),
  })
  .strict();

export type CustomerSearchResult = {
  id: string;
  name: string | null;
  maskedEmail: string;
  currentBalance: number;
  isSelf: boolean;
};

/**
 * Customer search inside manual adjustment dialog.
 * Permission: rewards.adjust
 * Rate limited to 30 queries per minute per staff member.
 * Minimum 3 chars, returns at most 10 results with masked emails.
 */
export async function searchCustomersForAdjustmentAction(
  rawInput: unknown,
): Promise<Result<CustomerSearchResult[]>> {
  const staff = await requireStaff();
  await requirePermission("rewards.adjust");

  const limitRes = await limit(`rewards:adjust:customer-search:${staff.id}`, 30, 60);
  if (!limitRes.allowed) {
    return err("CONFLICT", `Search rate limit reached. Please wait ${limitRes.retryAfterSeconds} seconds.`);
  }

  const parsed = searchCustomerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid search query.");
  }

  const staffUser = await db.user.findUnique({
    where: { id: staff.id },
    select: { email: true },
  });

  const users = await db.user.findMany({
    where: {
      type: "CUSTOMER",
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { name: { contains: parsed.data.query, mode: "insensitive" } },
        { email: { contains: parsed.data.query, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: {
      id: true,
      name: true,
      email: true,
      profile: {
        select: {
          pointsBalance: true,
        },
      },
    },
  });

  const results: CustomerSearchResult[] = users.map((u) => {
    const isSelf =
      u.id === staff.id ||
      (Boolean(staffUser?.email) && u.email.toLowerCase() === staffUser?.email.toLowerCase());
    return {
      id: u.id,
      name: u.name,
      maskedEmail: maskEmail(u.email),
      currentBalance: u.profile?.pointsBalance ?? 0,
      isSelf,
    };
  });

  return ok(results);
}

/**
 * Get active rule caps and real-time customer balance for adjustment dialog.
 * Permission: rewards.adjust
 */
export async function getCustomerAdjustmentCapsAction(
  rawUserId: unknown,
): Promise<
  Result<{
    currentBalance: number;
    lifetimePointsEarned: number;
    manualAdjustMaxPoints: number;
    manualAdjustApprovalThreshold: number;
    maxPointsPerCustomer: number | null;
    isOwnAccount: boolean;
  }>
> {
  const staff = await requireStaff();
  await requirePermission("rewards.adjust");

  const parsed = z.string().uuid().safeParse(rawUserId);
  if (!parsed.success) return err("VALIDATION", "Invalid user ID.");

  const [customer, staffUser, rule] = await Promise.all([
    db.user.findUnique({
      where: { id: parsed.data },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            pointsBalance: true,
            lifetimePointsEarned: true,
          },
        },
      },
    }),
    db.user.findUnique({
      where: { id: staff.id },
      select: { email: true },
    }),
    getActiveRewardRuleWithTiers(db),
  ]);

  if (!customer) return err("NOT_FOUND", "Customer not found.");

  const isOwnAccount =
    customer.id === staff.id ||
    (Boolean(staffUser?.email) && customer.email.toLowerCase() === staffUser?.email.toLowerCase());

  return ok({
    currentBalance: customer.profile?.pointsBalance ?? 0,
    lifetimePointsEarned: customer.profile?.lifetimePointsEarned ?? 0,
    manualAdjustMaxPoints: rule?.manualAdjustMaxPoints ?? 0,
    manualAdjustApprovalThreshold: rule?.manualAdjustApprovalThreshold ?? 0,
    maxPointsPerCustomer: rule?.maxPointsPerCustomer ?? null,
    isOwnAccount,
  });
}

const requestAdjustmentSchema = z
  .object({
    userId: z.string().uuid("Invalid customer ID"),
    points: z
      .number()
      .int()
      .refine((n) => n !== 0, "Adjustment points cannot be zero"),
    reason: z
      .string()
      .trim()
      .min(5, "Reason must be at least 5 characters")
      .max(500, "Reason cannot exceed 500 characters"),
    clientKey: z.string().trim().min(8).max(64),
  })
  .strict();

/**
 * Creates or applies a manual points adjustment.
 * Enforces:
 * - Cannot adjust own customer account (by ID or email).
 * - Caps and thresholds checked server-side.
 * - Idempotency key.
 * - Mandatory plain-text reason.
 * Permission: rewards.adjust
 */
export async function requestPointsAdjustmentAction(
  rawInput: unknown,
): Promise<
  Result<{
    status: "APPLIED" | "PENDING_APPROVAL";
    ledgerEntryId?: string;
    requestId?: string;
    message: string;
  }>
> {
  const staff = await requireStaff();
  await requirePermission("rewards.adjust");

  const parsed = requestAdjustmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err("VALIDATION", "Invalid adjustment input", parsed.error.flatten().fieldErrors);
  }

  const { userId, points, reason, clientKey } = parsed.data;

  // Self-adjustment check: staff cannot adjust points on their own customer account
  const [targetUser, staffUser] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
    db.user.findUnique({ where: { id: staff.id }, select: { id: true, email: true } }),
  ]);

  if (!targetUser) return err("NOT_FOUND", "Target customer not found.");

  if (
    targetUser.id === staff.id ||
    (Boolean(staffUser?.email) && targetUser.email.toLowerCase() === staffUser?.email.toLowerCase())
  ) {
    return err("FORBIDDEN", "Staff members cannot adjust points on their own account.");
  }

  const isSuperAdmin = staff.roleNames.includes("Super Admin");

  const result = await adjustPoints({
    userId,
    points,
    reason,
    actorId: staff.id,
    isSuperAdmin,
    clientKey,
  });

  if (!result.ok) {
    return err(result.error.code, result.error.message);
  }

  const requestHeaders = await headers();
  if (result.data.status === "APPLIED") {
    await audit({
      actor: { id: staff.id, type: "STAFF" },
      action: "rewards.adjust",
      entityType: "PointsLedger",
      entityId: result.data.ledgerEntry.id,
      after: {
        userId,
        points,
        balanceAfter: result.data.ledgerEntry.balanceAfter,
        reason,
        idempotencyKey: result.data.ledgerEntry.idempotencyKey,
      },
      ip: requestHeaders.get("cf-connecting-ip") ?? "unknown",
      userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
      requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
    });

    return ok({
      status: "APPLIED",
      ledgerEntryId: result.data.ledgerEntry.id,
      message: `Successfully applied adjustment of ${points > 0 ? `+${points}` : points} points.`,
    });
  }

  // PENDING_APPROVAL
  await audit({
    actor: { id: staff.id, type: "STAFF" },
    action: "rewards.adjust.requested",
    entityType: "PointsAdjustmentRequest",
    entityId: result.data.requestId,
    after: {
      userId,
      points,
      reason,
      status: "PENDING",
      idempotencyKey: `adjust_req:${userId}:${clientKey}`,
    },
    ip: requestHeaders.get("cf-connecting-ip") ?? "unknown",
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  return ok({
    status: "PENDING_APPROVAL",
    requestId: result.data.requestId,
    message: `Adjustment of ${points > 0 ? `+${points}` : points} points exceeds threshold and requires a second staff approval.`,
  });
}

export type PendingAdjustmentItem = {
  id: string;
  userId: string;
  customerName: string | null;
  customerMaskedEmail: string;
  points: number;
  reason: string;
  requestedById: string;
  requestedByName: string | null;
  createdAt: string;
  canApprove: boolean;
};

/**
 * List pending points adjustment requests.
 * Permission: rewards.adjust or rewards.adjust.approve
 */
export async function listPendingAdjustmentsAction(): Promise<
  Result<PendingAdjustmentItem[]>
> {
  const staff = await requireStaff();
  await requirePermission("rewards.adjust");

  const pendingRequests = await db.pointsAdjustmentRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });

  const staffUser = await db.user.findUnique({
    where: { id: staff.id },
    select: { email: true },
  });

  const rows = pendingRequests.map((req) => {
    const isOwnRequest = req.requestedById === staff.id;
    const isOwnCustomer =
      req.userId === staff.id ||
      (Boolean(staffUser?.email) && req.user.email.toLowerCase() === staffUser?.email.toLowerCase());
    const canApprove = !isOwnRequest && !isOwnCustomer;

    return {
      id: req.id,
      userId: req.userId,
      customerName: req.user.name,
      customerMaskedEmail: maskEmail(req.user.email),
      points: req.points,
      reason: req.reason,
      requestedById: req.requestedById,
      requestedByName: req.requestedBy.name,
      createdAt: req.createdAt.toISOString(),
      canApprove,
    };
  });

  return ok(rows);
}

const approveAdjustmentSchema = z
  .object({
    requestId: z.string().uuid("Invalid request ID"),
    clientKey: z.string().trim().min(8).max(64).optional(),
  })
  .strict();

/**
 * Second approver approval of a pending adjustment.
 * Permission: rewards.adjust.approve
 * Re-validates active rule, cap limits, requester != approver, and resulting balance >= 0.
 */
export async function approveAdjustmentAction(
  rawInput: unknown,
): Promise<Result<{ ledgerEntryId: string; message: string }>> {
  const staff = await requireStaff();
  await requirePermission("rewards.adjust.approve");

  const parsed = approveAdjustmentSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid approval request.");

  const { requestId, clientKey } = parsed.data;

  // Retrieve request to verify self-approval guards
  const existingReq = await db.pointsAdjustmentRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

  if (!existingReq) return err("NOT_FOUND", "Adjustment request not found.");

  if (existingReq.requestedById === staff.id) {
    return err("FORBIDDEN", "Staff members cannot approve their own adjustment request, even Super Admins.");
  }

  const staffUser = await db.user.findUnique({
    where: { id: staff.id },
    select: { email: true },
  });

  if (
    existingReq.userId === staff.id ||
    (Boolean(staffUser?.email) && existingReq.user.email.toLowerCase() === staffUser?.email.toLowerCase())
  ) {
    return err("FORBIDDEN", "Cannot approve an adjustment for your own customer account.");
  }

  const idempotencyKey = clientKey ? `adjust_approved:${requestId}:${clientKey}` : undefined;

  const result = await approveAdjustment({
    requestId,
    decidedById: staff.id,
    idempotencyKey,
  });

  if (!result.ok) {
    return err(result.error.code, result.error.message);
  }

  const requestHeaders = await headers();
  await audit({
    actor: { id: staff.id, type: "STAFF" },
    action: "rewards.adjust.approved",
    entityType: "PointsAdjustmentRequest",
    entityId: requestId,
    after: {
      requestId,
      ledgerEntryId: result.data.ledgerEntry.id,
      points: result.data.ledgerEntry.points,
      balanceAfter: result.data.ledgerEntry.balanceAfter,
      secondApproverId: staff.id,
    },
    ip: requestHeaders.get("cf-connecting-ip") ?? "unknown",
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  return ok({
    ledgerEntryId: result.data.ledgerEntry.id,
    message: "Adjustment request approved and points credited successfully.",
  });
}

const rejectAdjustmentSchema = z
  .object({
    requestId: z.string().uuid("Invalid request ID"),
    reason: z
      .string()
      .trim()
      .min(3, "Rejection reason must be at least 3 characters")
      .max(500, "Reason cannot exceed 500 characters"),
  })
  .strict();

/**
 * Rejects a pending points adjustment.
 * Permission: rewards.adjust.approve
 */
export async function rejectAdjustmentAction(
  rawInput: unknown,
): Promise<Result<{ message: string }>> {
  const staff = await requireStaff();
  await requirePermission("rewards.adjust.approve");

  const parsed = rejectAdjustmentSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid rejection input.");

  const { requestId, reason } = parsed.data;

  const existingReq = await db.pointsAdjustmentRequest.findUnique({
    where: { id: requestId },
  });
  if (!existingReq) return err("NOT_FOUND", "Adjustment request not found.");

  if (existingReq.requestedById === staff.id) {
    return err("FORBIDDEN", "Staff members cannot reject their own adjustment request.");
  }

  const result = await rejectAdjustment({
    requestId,
    decidedById: staff.id,
    reason,
  });

  if (!result.ok) {
    return err(result.error.code, result.error.message);
  }

  const requestHeaders = await headers();
  await audit({
    actor: { id: staff.id, type: "STAFF" },
    action: "rewards.adjust.rejected",
    entityType: "PointsAdjustmentRequest",
    entityId: requestId,
    after: {
      requestId,
      status: "REJECTED",
      decidedById: staff.id,
      rejectionReason: reason,
    },
    ip: requestHeaders.get("cf-connecting-ip") ?? "unknown",
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  return ok({ message: "Adjustment request has been rejected." });
}
