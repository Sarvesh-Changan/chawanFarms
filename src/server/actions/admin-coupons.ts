"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { Prisma, type CouponStatus } from "@/generated/prisma/client";
import { maskEmail } from "@/lib/mask";
import { err, ok, type Result } from "@/lib/result";
import { requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { revokeCouponService } from "@/server/services/coupons";

const couponListFilterSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
    status: z.enum(["ALL", "ACTIVE", "REDEEMED", "REVOKED", "EXPIRED"]).default("ALL"),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(["issuedAt", "expiresAt", "pointsSpent"]).default("issuedAt"),
    direction: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type AdminCouponRow = {
  id: string;
  code: string;
  status: CouponStatus;
  customer: {
    id: string;
    name: string | null;
    maskedEmail: string;
  };
  tier: {
    id: string;
    name: string;
  };
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxDiscountPaise: number | null;
  minBookingPaise: number | null;
  pointsSpent: number;
  issuedAt: string;
  expiresAt: string;
  isExpired: boolean;
  isAttachedToPendingBooking: boolean;
  redemptionsCount: number;
};

export type CouponRedemptionDetail = {
  id: string;
  bookingId: string;
  bookingReference: string | null;
  bookingStatus: string;
  discountPaise: number;
  redeemedAt: string;
  releasedAt: string | null;
  releaseReason: string | null;
};

/**
 * List coupons with filters and search.
 * Permission: coupons.read
 */
export async function listCouponsAction(
  rawInput: unknown,
): Promise<Result<{ rows: AdminCouponRow[]; total: number; page: number; pageSize: number; pageCount: number }>> {
  await requireStaff();
  await requirePermission("coupons.read");

  const parsed = couponListFilterSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return err("VALIDATION", "Invalid coupon filters", parsed.error.flatten().fieldErrors);
  }

  const { page, pageSize, status, search, sort, direction } = parsed.data;
  const now = new Date();

  const where: Prisma.CouponWhereInput = {};

  if (status === "EXPIRED") {
    where.status = "ACTIVE";
    where.expiresAt = { lte: now };
  } else if (status === "ACTIVE") {
    where.status = "ACTIVE";
    where.expiresAt = { gt: now };
  } else if (status !== "ALL") {
    where.status = status;
  }

  if (search && search.length > 0) {
    const matchingUsers = await db.user.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 100,
    });
    where.OR = [
      { code: { contains: search.toUpperCase(), mode: "insensitive" } },
      { userId: { in: matchingUsers.map((u) => u.id) } },
    ];
  }

  const [total, coupons] = await Promise.all([
    db.coupon.count({ where }),
    db.coupon.findMany({
      where,
      orderBy: { [sort]: direction },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
        tier: { select: { id: true, name: true } },
        redemptions: { select: { id: true } },
      },
    }),
  ]);

  // Check if active coupons are attached to pending bookings
  const couponIds = coupons.map((c) => c.id);
  const pendingBookings = couponIds.length > 0
    ? await db.booking.findMany({
        where: {
          couponId: { in: couponIds },
          status: { in: ["ENQUIRY", "PENDING_CONFIRMATION"] },
          deletedAt: null,
        },
        select: { couponId: true },
      })
    : [];
  const pendingAttachedSet = new Set(pendingBookings.map((b) => b.couponId).filter(Boolean));

  const rows: AdminCouponRow[] = coupons.map((c) => {
    const isExpired = c.expiresAt.getTime() <= now.getTime();
    return {
      id: c.id,
      code: c.code,
      status: c.status,
      customer: {
        id: c.user.id,
        name: c.user.name,
        maskedEmail: maskEmail(c.user.email),
      },
      tier: {
        id: c.tier.id,
        name: c.tier.name,
      },
      discountType: c.discountType,
      discountValue: c.discountValue,
      maxDiscountPaise: c.maxDiscountPaise,
      minBookingPaise: c.minBookingPaise,
      pointsSpent: c.pointsSpent,
      issuedAt: c.issuedAt.toISOString(),
      expiresAt: c.expiresAt.toISOString(),
      isExpired,
      isAttachedToPendingBooking: pendingAttachedSet.has(c.id),
      redemptionsCount: c.redemptions.length,
    };
  });

  return ok({
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  });
}

/**
 * Get redemption history for a coupon.
 * Permission: coupons.read
 */
export async function getCouponRedemptionHistoryAction(
  rawCouponId: unknown,
): Promise<Result<CouponRedemptionDetail[]>> {
  await requireStaff();
  await requirePermission("coupons.read");

  const parsed = z.string().uuid("Invalid coupon ID").safeParse(rawCouponId);
  if (!parsed.success) return err("VALIDATION", "Invalid coupon ID.");

  const redemptions = await db.couponRedemption.findMany({
    where: { couponId: parsed.data },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true,
          reference: true,
          status: true,
        },
      },
    },
  });

  const history: CouponRedemptionDetail[] = redemptions.map((r) => ({
    id: r.id,
    bookingId: r.booking.id,
    bookingReference: r.booking.reference,
    bookingStatus: r.booking.status,
    discountPaise: r.discountPaise,
    redeemedAt: r.createdAt.toISOString(),
    releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
    releaseReason: r.releaseReason,
  }));

  return ok(history);
}

const revokeCouponSchema = z
  .object({
    couponId: z.string().uuid("Invalid coupon ID"),
    reason: z
      .string()
      .trim()
      .min(5, "Revocation reason must be at least 5 characters")
      .max(500, "Reason cannot exceed 500 characters"),
  })
  .strict();

/**
 * Revokes an ACTIVE coupon.
 * Requires:
 * - coupons.revoke permission.
 * - Coupon must be ACTIVE.
 * - Coupon must NOT be attached to a pending booking.
 * - Mandatory plain-text reason.
 * - Audited with before and after state.
 */
export async function revokeCouponAction(
  rawInput: unknown,
): Promise<Result<{ message: string; couponId: string }>> {
  const staff = await requireStaff();
  await requirePermission("coupons.revoke");

  const parsed = revokeCouponSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err("VALIDATION", "Invalid revocation input", parsed.error.flatten().fieldErrors);
  }

  const { couponId, reason } = parsed.data;

  // Retrieve existing state for before audit
  const existing = await db.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, code: true, status: true, userId: true },
  });

  if (!existing) return err("NOT_FOUND", "Coupon not found.");
  if (existing.status !== "ACTIVE") {
    return err("CONFLICT", `Cannot revoke coupon with status ${existing.status}. Only ACTIVE coupons can be revoked.`);
  }

  const result = await revokeCouponService({
    couponId,
    reason,
    actorId: staff.id,
  });

  if (!result.ok) {
    return err(result.error.code, result.error.message);
  }

  const requestHeaders = await headers();
  await audit({
    actor: { id: staff.id, type: "STAFF" },
    action: "coupons.revoke",
    entityType: "Coupon",
    entityId: couponId,
    before: {
      id: existing.id,
      code: existing.code,
      status: existing.status,
      userId: existing.userId,
    },
    after: {
      id: result.data.coupon.id,
      code: result.data.coupon.code,
      status: result.data.coupon.status,
      revocationReason: reason,
      userId: existing.userId,
    },
    ip: requestHeaders.get("cf-connecting-ip") ?? "unknown",
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  return ok({
    couponId,
    message: `Coupon ${existing.code} has been successfully revoked.`,
  });
}
