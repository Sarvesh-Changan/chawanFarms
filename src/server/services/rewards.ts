import "server-only";

/**
 * REWARD ENGINE SERVICE — Transactional integrity & anti-fraud.
 *
 * LOCK ORDER (Must be strictly followed to prevent deadlocks):
 * 1. CustomerProfile
 * 2. Coupon
 * 3. Booking
 */

import { Prisma, type PointsLedger, type PrismaClient } from "@/generated/prisma/client";
import { err, ok, type Result } from "@/lib/result";
import { db } from "@/server/db";
import {
  evaluateAdjustCaps,
  evaluateEarnCaps,
  evaluateRedeemCaps,
  type RewardRuleCaps,
  type RewardTierSnapshot,
} from "@/server/policies/rewardCaps";
import { issueCoupon } from "@/server/services/coupons";

export type DbOrTx = PrismaClient | Prisma.TransactionClient;

async function runWithTx<T>(
  client: DbOrTx,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in client && typeof client.$transaction === "function") {
    return client.$transaction(fn);
  }
  return fn(client as Prisma.TransactionClient);
}

export type RewardServiceError =
  | "REWARDS_DISABLED"
  | "USER_NOT_FOUND"
  | "PROFILE_NOT_FOUND"
  | "VIDEO_NOT_FOUND"
  | "SUBMISSION_ALREADY_REWARDED"
  | "TIER_NOT_FOUND"
  | "TIER_INACTIVE"
  | "INSUFFICIENT_POINTS"
  | "TIER_BELOW_MIN_REDEEM"
  | "LIFETIME_CAP_EXCEEDED"
  | "PERIOD_SUBMISSION_CAP_REACHED"
  | "ZERO_POINTS"
  | "EMPTY_REASON"
  | "NEGATIVE_BALANCE"
  | "ADJUSTMENT_EXCEEDS_CAP"
  | "CANNOT_APPROVE_OWN_REQUEST"
  | "REQUEST_NOT_PENDING"
  | "REQUEST_NOT_FOUND"
  | "TARGET_NOT_REVERSIBLE"
  | "ENTRY_ALREADY_REVERSED"
  | "COUPON_ALREADY_USED"
  | "INSUFFICIENT_BALANCE_FOR_REVERSAL"
  | "ENTRY_NOT_FOUND";

/**
 * Loads the active RewardRule with its active tiers.
 */
export async function getActiveRewardRuleWithTiers(tx: Prisma.TransactionClient = db) {
  return tx.rewardRule.findFirst({
    where: { isActive: true },
    include: {
      tiers: {
        where: { isActive: true },
        include: {
          packages: true,
          accommodations: true,
        },
      },
    },
  });
}

/**
 * Locks the customer profile row in PostgreSQL using SELECT ... FOR UPDATE.
 * Ensures strict sequential execution for balance-modifying operations.
 */
async function lockCustomerProfile(tx: Prisma.TransactionClient, userId: string) {
  // Ensure profile exists first
  let profile = await tx.customerProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await tx.customerProfile.create({
      data: {
        userId,
        referralCode: `CF${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        pointsBalance: 0,
        lifetimePointsEarned: 0,
      },
    });
  }

  // Acquire pessimistic exclusive row lock
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "CustomerProfile" WHERE "userId" = ${userId} FOR UPDATE`,
  );

  return profile;
}

/**
 * 1. EARN POINTS FOR APPROVED VIDEO
 * Called internally by video approval.
 * Accepts an optional transaction client (e.g. from approval workflow).
 */
export async function earnPointsForApprovedVideo(
  input: {
    videoSubmissionId: string;
    actorId: string;
  },
  externalTx?: Prisma.TransactionClient,
): Promise<Result<{ ledgerEntry: PointsLedger; pointsAwarded: number }>> {
  const execute = async (tx: Prisma.TransactionClient) => {
    // Check idempotency first
    const idempotencyKey = `earn:${input.videoSubmissionId}`;
    const existing = await tx.pointsLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return ok({ ledgerEntry: existing, pointsAwarded: existing.points });
    }

    const video = await tx.videoSubmission.findUnique({
      where: { id: input.videoSubmissionId },
      select: { id: true, userId: true, status: true },
    });
    if (!video) {
      return err("NOT_FOUND", "Video submission not found.");
    }

    const rule = await getActiveRewardRuleWithTiers(tx);
    if (!rule) {
      return err("UNAVAILABLE", "Rewards program is currently disabled.");
    }

    // 1. Lock CustomerProfile first
    const profile = await lockCustomerProfile(tx, video.userId);

    // Count EARN submissions in the rolling period
    let recentEarnCount = 0;
    if (rule.maxSubmissionsPerPeriod !== null && rule.periodDays !== null) {
      const periodStart = new Date(Date.now() - rule.periodDays * 24 * 60 * 60 * 1000);
      recentEarnCount = await tx.pointsLedger.count({
        where: {
          userId: video.userId,
          type: "EARN",
          createdAt: { gte: periodStart },
        },
      });
    }

    const ruleCaps: RewardRuleCaps = {
      id: rule.id,
      pointsPerApprovedVideo: rule.pointsPerApprovedVideo,
      maxPointsPerCustomer: rule.maxPointsPerCustomer,
      maxSubmissionsPerPeriod: rule.maxSubmissionsPerPeriod,
      periodDays: rule.periodDays,
      pointExpiryDays: rule.pointExpiryDays,
      minPointsToRedeem: rule.minPointsToRedeem,
      couponValidityDays: rule.couponValidityDays,
      allowCombineWithOffers: rule.allowCombineWithOffers,
      allowMultipleCouponsPerBooking: rule.allowMultipleCouponsPerBooking,
      manualAdjustMaxPoints: rule.manualAdjustMaxPoints,
      manualAdjustApprovalThreshold: rule.manualAdjustApprovalThreshold,
    };

    const evaluation = evaluateEarnCaps({
      rule: ruleCaps,
      currentLifetimePoints: profile.lifetimePointsEarned,
      recentPeriodEarnCount: recentEarnCount,
    });

    if (!evaluation.allowed) {
      return err("VALIDATION", evaluation.message);
    }

    const pointsToAward = evaluation.pointsToAward;
    const balanceAfter = profile.pointsBalance + pointsToAward;
    const expiresAt = rule.pointExpiryDays
      ? new Date(Date.now() + rule.pointExpiryDays * 24 * 60 * 60 * 1000)
      : null;

    // Insert immutable PointsLedger row
    const ledgerEntry = await tx.pointsLedger.create({
      data: {
        userId: video.userId,
        type: "EARN",
        points: pointsToAward,
        balanceAfter,
        idempotencyKey,
        videoSubmissionId: video.id,
        ruleId: rule.id,
        actorId: input.actorId,
        expiresAt,
      },
    });

    // Update CustomerProfile cached balances
    await tx.customerProfile.update({
      where: { userId: video.userId },
      data: {
        pointsBalance: balanceAfter,
        lifetimePointsEarned: profile.lifetimePointsEarned + pointsToAward,
      },
    });

    // Update video submission status and reward snapshot
    const updatedVideo = await tx.videoSubmission.updateMany({
      where: { id: video.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        pointsAwarded: pointsToAward,
        rewardRuleId: rule.id,
        reviewedById: input.actorId,
        reviewedAt: new Date(),
      },
    });

    if (updatedVideo.count !== 1) {
      return err("CONFLICT", "This video has already been reviewed.");
    }

    return ok({ ledgerEntry, pointsAwarded: pointsToAward });
  };

  if (externalTx) {
    return execute(externalTx);
  }
  return db.$transaction(execute);
}

/**
 * 2. REDEEM POINTS FOR COUPON
 * Deducts points, issues a cryptographically random coupon, and writes a REDEEM ledger entry.
 */
export async function redeemPoints(
  input: {
    userId: string;
    tierId: string;
    clientKey: string;
  },
  client: DbOrTx = db,
): Promise<Result<{ coupon: unknown; ledgerEntry: PointsLedger }>> {
  return runWithTx(client, async (tx) => {
    const idempotencyKey = `redeem:${input.userId}:${input.clientKey}`;

    // Check idempotency first
    const existing = await tx.pointsLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing && existing.couponId) {
      const existingCoupon = await tx.coupon.findUnique({
        where: { id: existing.couponId },
      });
      return ok({ coupon: existingCoupon, ledgerEntry: existing });
    }

    const rule = await getActiveRewardRuleWithTiers(tx);
    if (!rule) {
      return err("UNAVAILABLE", "Rewards program is currently disabled.");
    }

    const tier = rule.tiers.find((t) => t.id === input.tierId);
    if (!tier) {
      return err("NOT_FOUND", "The requested reward tier is not part of the active rule.");
    }

    // 1. Lock CustomerProfile first
    const profile = await lockCustomerProfile(tx, input.userId);

    const ruleCaps: RewardRuleCaps = {
      id: rule.id,
      pointsPerApprovedVideo: rule.pointsPerApprovedVideo,
      maxPointsPerCustomer: rule.maxPointsPerCustomer,
      maxSubmissionsPerPeriod: rule.maxSubmissionsPerPeriod,
      periodDays: rule.periodDays,
      pointExpiryDays: rule.pointExpiryDays,
      minPointsToRedeem: rule.minPointsToRedeem,
      couponValidityDays: rule.couponValidityDays,
      allowCombineWithOffers: rule.allowCombineWithOffers,
      allowMultipleCouponsPerBooking: rule.allowMultipleCouponsPerBooking,
      manualAdjustMaxPoints: rule.manualAdjustMaxPoints,
      manualAdjustApprovalThreshold: rule.manualAdjustApprovalThreshold,
    };

    const tierSnapshot: RewardTierSnapshot = {
      id: tier.id,
      ruleId: tier.ruleId,
      name: tier.name,
      pointsCost: tier.pointsCost,
      discountType: tier.discountType,
      discountValue: tier.discountValue,
      maxDiscountPaise: tier.maxDiscountPaise,
      minBookingPaise: tier.minBookingPaise,
      allPackages: tier.allPackages,
      allAccommodation: tier.allAccommodation,
      isActive: tier.isActive,
    };

    const evaluation = evaluateRedeemCaps({
      rule: ruleCaps,
      tier: tierSnapshot,
      currentBalance: profile.pointsBalance,
    });

    if (!evaluation.allowed) {
      return err("VALIDATION", evaluation.message);
    }

    // Issue the coupon (lock order: CustomerProfile locked, now creating Coupon)
    const coupon = await issueCoupon(tx, {
      userId: input.userId,
      tier: tierSnapshot,
      validityDays: rule.couponValidityDays,
    });

    const balanceAfter = profile.pointsBalance - tier.pointsCost;

    // Write immutable REDEEM ledger entry
    const ledgerEntry = await tx.pointsLedger.create({
      data: {
        userId: input.userId,
        type: "REDEEM",
        points: -tier.pointsCost,
        balanceAfter,
        idempotencyKey,
        couponId: coupon.id,
        ruleId: rule.id,
      },
    });

    // Update CustomerProfile pointsBalance
    await tx.customerProfile.update({
      where: { userId: input.userId },
      data: {
        pointsBalance: balanceAfter,
      },
    });

    return ok({ coupon, ledgerEntry });
  });
}

/**
 * 3. ADJUST POINTS
 * Admin manual point adjustments.
 * If points exceed manualAdjustApprovalThreshold, creates a PENDING PointsAdjustmentRequest.
 * Otherwise applies immediately.
 */
export async function adjustPoints(
  input: {
    userId: string;
    points: number;
    reason: string;
    actorId: string;
    isSuperAdmin: boolean;
    clientKey: string;
    secondApproverId?: string;
  },
  client: DbOrTx = db,
): Promise<
  Result<
    | { status: "APPLIED"; ledgerEntry: PointsLedger }
    | { status: "PENDING_APPROVAL"; requestId: string }
  >
> {
  return runWithTx(client, async (tx) => {
    const idempotencyKey = `adjust:${input.userId}:${input.clientKey}`;

    const existing = await tx.pointsLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return ok({ status: "APPLIED", ledgerEntry: existing });
    }

    const rule = await getActiveRewardRuleWithTiers(tx);
    if (!rule) {
      return err("UNAVAILABLE", "Rewards program is currently disabled.");
    }

    // Lock CustomerProfile first
    const profile = await lockCustomerProfile(tx, input.userId);

    const ruleCaps: RewardRuleCaps = {
      id: rule.id,
      pointsPerApprovedVideo: rule.pointsPerApprovedVideo,
      maxPointsPerCustomer: rule.maxPointsPerCustomer,
      maxSubmissionsPerPeriod: rule.maxSubmissionsPerPeriod,
      periodDays: rule.periodDays,
      pointExpiryDays: rule.pointExpiryDays,
      minPointsToRedeem: rule.minPointsToRedeem,
      couponValidityDays: rule.couponValidityDays,
      allowCombineWithOffers: rule.allowCombineWithOffers,
      allowMultipleCouponsPerBooking: rule.allowMultipleCouponsPerBooking,
      manualAdjustMaxPoints: rule.manualAdjustMaxPoints,
      manualAdjustApprovalThreshold: rule.manualAdjustApprovalThreshold,
    };

    const evaluation = evaluateAdjustCaps({
      rule: ruleCaps,
      points: input.points,
      reason: input.reason,
      currentBalance: profile.pointsBalance,
      isSuperAdmin: input.isSuperAdmin,
    });

    if (!evaluation.allowed) {
      return err("VALIDATION", evaluation.message);
    }

    // Check if second approver is required
    if (evaluation.requiresSecondApprover && !input.secondApproverId) {
      const request = await tx.pointsAdjustmentRequest.upsert({
        where: { idempotencyKey: `adjust_req:${input.userId}:${input.clientKey}` },
        update: {},
        create: {
          userId: input.userId,
          points: input.points,
          reason: input.reason.trim(),
          requestedById: input.actorId,
          status: "PENDING",
          idempotencyKey: `adjust_req:${input.userId}:${input.clientKey}`,
        },
      });

      return ok({ status: "PENDING_APPROVAL", requestId: request.id });
    }

    if (input.secondApproverId && input.secondApproverId === input.actorId) {
      return err("FORBIDDEN", "Requester and approver must be different staff members.");
    }

    const balanceAfter = profile.pointsBalance + input.points;

    const ledgerEntry = await tx.pointsLedger.create({
      data: {
        userId: input.userId,
        type: "ADJUST",
        points: input.points,
        balanceAfter,
        idempotencyKey,
        ruleId: rule.id,
        reason: input.reason.trim(),
        actorId: input.actorId,
        secondApproverId: input.secondApproverId ?? null,
      },
    });

    await tx.customerProfile.update({
      where: { userId: input.userId },
      data: {
        pointsBalance: balanceAfter,
      },
    });

    return ok({ status: "APPLIED", ledgerEntry });
  });
}

/**
 * 4. APPROVE ADJUSTMENT
 * Second approver acts on a pending PointsAdjustmentRequest.
 * Writes a NEW immutable ADJUST ledger row.
 */
export async function approveAdjustment(
  input: {
    requestId: string;
    decidedById: string;
    idempotencyKey?: string;
  },
  client: DbOrTx = db,
): Promise<Result<{ status: "APPROVED"; ledgerEntry: PointsLedger }>> {
  return runWithTx(client, async (tx) => {
    const request = await tx.pointsAdjustmentRequest.findUnique({
      where: { id: input.requestId },
    });
    if (!request) {
      return err("NOT_FOUND", "Adjustment request not found.");
    }

    if (request.status !== "PENDING") {
      return err("CONFLICT", "Adjustment request has already been decided.");
    }

    if (request.requestedById === input.decidedById) {
      return err("FORBIDDEN", "Staff member cannot approve their own adjustment request.");
    }

    const rule = await getActiveRewardRuleWithTiers(tx);
    if (!rule) {
      return err("UNAVAILABLE", "Rewards program is currently disabled. An active rule is required to approve adjustments.");
    }

    // Lock CustomerProfile first
    const profile = await lockCustomerProfile(tx, request.userId);

    if (profile.pointsBalance + request.points < 0) {
      return err("VALIDATION", "Approved adjustment would cause customer balance to drop below zero.");
    }

    if (rule.maxPointsPerCustomer && request.points > 0) {
      if (profile.lifetimePointsEarned + request.points > rule.maxPointsPerCustomer) {
        return err("VALIDATION", "Approved adjustment would exceed customer lifetime points cap.");
      }
    }

    const balanceAfter = profile.pointsBalance + request.points;
    const ledgerKey = input.idempotencyKey ?? `adjust_approved:${request.id}`;

    const existingLedger = await tx.pointsLedger.findUnique({
      where: { idempotencyKey: ledgerKey },
    });
    if (existingLedger) {
      return ok({ status: "APPROVED", ledgerEntry: existingLedger });
    }

    const ledgerEntry = await tx.pointsLedger.create({
      data: {
        userId: request.userId,
        type: "ADJUST",
        points: request.points,
        balanceAfter,
        idempotencyKey: ledgerKey,
        ruleId: rule.id,
        reason: request.reason,
        actorId: request.requestedById,
        secondApproverId: input.decidedById,
      },
    });

    await tx.customerProfile.update({
      where: { userId: request.userId },
      data: {
        pointsBalance: balanceAfter,
        lifetimePointsEarned:
          request.points > 0
            ? profile.lifetimePointsEarned + request.points
            : profile.lifetimePointsEarned,
      },
    });

    await tx.pointsAdjustmentRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedById: input.decidedById,
        decidedAt: new Date(),
        ledgerEntryId: ledgerEntry.id,
      },
    });

    return ok({ status: "APPROVED", ledgerEntry });
  });
}

/**
 * 5. REJECT ADJUSTMENT
 */
export async function rejectAdjustment(
  input: {
    requestId: string;
    decidedById: string;
    reason?: string;
  },
  client: DbOrTx = db,
): Promise<Result<{ status: "REJECTED" }>> {
  return runWithTx(client, async (tx) => {
    const request = await tx.pointsAdjustmentRequest.findUnique({
      where: { id: input.requestId },
    });
    if (!request) {
      return err("NOT_FOUND", "Adjustment request not found.");
    }

    if (request.status !== "PENDING") {
      return err("CONFLICT", "Adjustment request has already been decided.");
    }

    if (request.requestedById === input.decidedById) {
      return err("FORBIDDEN", "Staff member cannot reject their own adjustment request.");
    }

    await tx.pointsAdjustmentRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        decidedById: input.decidedById,
        decidedAt: new Date(),
        reason: input.reason ? `${request.reason} [Rejected: ${input.reason.trim()}]` : request.reason,
      },
    });

    return ok({ status: "REJECTED" });
  });
}

/**
 * 6. REVERSE ENTRY
 * Reverses an EARN, REDEEM, or ADJUST ledger row.
 * Refuses EXPIRE/REVERSE targets, multiple reversals, negative balance outcomes,
 * and redemption reversals for coupons that have already been used on confirmed bookings.
 */
export async function reverseEntry(
  input: {
    ledgerEntryId: string;
    actorId: string;
    reason: string;
  },
  client: DbOrTx = db,
): Promise<Result<{ ledgerEntry: PointsLedger }>> {
  return runWithTx(client, async (tx) => {
    const target = await tx.pointsLedger.findUnique({
      where: { id: input.ledgerEntryId },
    });
    if (!target) {
      return err("NOT_FOUND", "Ledger entry not found.");
    }

    if (target.type !== "EARN" && target.type !== "REDEEM" && target.type !== "ADJUST") {
      return err("VALIDATION", `Cannot reverse ledger entry of type ${target.type}.`);
    }

    // Check if entry already reversed (reversesEntryId is unique in DB)
    const existingReversal = await tx.pointsLedger.findUnique({
      where: { reversesEntryId: target.id },
    });
    if (existingReversal) {
      return err("CONFLICT", "This ledger entry has already been reversed.");
    }

    // 1. Lock CustomerProfile first
    const profile = await lockCustomerProfile(tx, target.userId);

    // If reversing a REDEEM entry, handle the associated coupon
    if (target.type === "REDEEM" && target.couponId) {
      // 2. Lock Coupon next
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Coupon" WHERE id = ${target.couponId} FOR UPDATE`,
      );

      const coupon = await tx.coupon.findUnique({
        where: { id: target.couponId },
        include: {
          redemptions: {
            where: { releasedAt: null },
          },
        },
      });

      if (coupon && coupon.redemptions.length > 0) {
        return err(
          "CONFLICT",
          "Cannot reverse redemption for a coupon that has an active booking redemption.",
        );
      }

      // Revoke the coupon if still ACTIVE
      if (coupon && coupon.status === "ACTIVE") {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { status: "REVOKED" },
        });
      }
    }

    // Opposite of target points
    const pointsToReverse = -target.points;
    const balanceAfter = profile.pointsBalance + pointsToReverse;

    if (balanceAfter < 0) {
      return err(
        "VALIDATION",
        `Reversal would cause balance (${balanceAfter}) to become negative.`,
      );
    }

    const ledgerEntry = await tx.pointsLedger.create({
      data: {
        userId: target.userId,
        type: "REVERSE",
        points: pointsToReverse,
        balanceAfter,
        idempotencyKey: `reverse:${target.id}`,
        reversesEntryId: target.id,
        ruleId: target.ruleId,
        reason: input.reason.trim(),
        actorId: input.actorId,
      },
    });

    const lifetimePointsUpdate =
      target.type === "EARN"
        ? Math.max(0, profile.lifetimePointsEarned - target.points)
        : profile.lifetimePointsEarned;

    await tx.customerProfile.update({
      where: { userId: target.userId },
      data: {
        pointsBalance: balanceAfter,
        lifetimePointsEarned: lifetimePointsUpdate,
      },
    });

    return ok({ ledgerEntry });
  });
}
