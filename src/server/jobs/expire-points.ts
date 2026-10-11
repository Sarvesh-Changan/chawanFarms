import "server-only";

/**
 * EXPIRE POINTS JOB
 * Per-user FIFO over EARN lots whose expiresAt <= now.
 * Runs inside a transaction with CustomerProfile locked.
 * Idempotency key: expire:<userId>:<lotId>
 * Never takes CustomerProfile.pointsBalance below 0.
 */

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type ExpirePointsResult = {
  expiredLotsProcessed: number;
  totalPointsExpired: number;
  usersAffected: number;
};

export async function processExpiredPointsLots(
  batchLimit = 100,
  asOf: Date = new Date(),
): Promise<ExpirePointsResult> {
  const expiredLots = await db.pointsLedger.findMany({
    where: {
      type: "EARN",
      expiresAt: { lte: asOf },
    },
    orderBy: { createdAt: "asc" },
    take: batchLimit,
    select: {
      id: true,
      userId: true,
      points: true,
      expiresAt: true,
      ruleId: true,
    },
  });

  let totalPointsExpired = 0;
  let expiredLotsProcessed = 0;
  const usersAffected = new Set<string>();

  for (const lot of expiredLots) {
    const expireKey = `expire:${lot.userId}:${lot.id}`;

    // Check if this lot was already expired
    const alreadyExpired = await db.pointsLedger.findUnique({
      where: { idempotencyKey: expireKey },
    });
    if (alreadyExpired) {
      continue;
    }

    await db.$transaction(async (tx) => {
      // 1. Lock CustomerProfile row FOR UPDATE
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "CustomerProfile" WHERE "userId" = ${lot.userId} FOR UPDATE`,
      );

      const profile = await tx.customerProfile.findUnique({
        where: { userId: lot.userId },
      });

      if (!profile || profile.pointsBalance <= 0) {
        // Record 0-point EXPIRE record to prevent re-processing
        await tx.pointsLedger.create({
          data: {
            userId: lot.userId,
            type: "EXPIRE",
            points: 0,
            balanceAfter: profile?.pointsBalance ?? 0,
            idempotencyKey: expireKey,
            ruleId: lot.ruleId,
            reason: `Lot ${lot.id} expired; balance already zero`,
          },
        });
        return;
      }

      // Decrement up to lot points, capped at available balance
      const pointsToDeduct = Math.min(lot.points, profile.pointsBalance);
      const balanceAfter = profile.pointsBalance - pointsToDeduct;

      await tx.pointsLedger.create({
        data: {
          userId: lot.userId,
          type: "EXPIRE",
          points: -pointsToDeduct,
          balanceAfter,
          idempotencyKey: expireKey,
          ruleId: lot.ruleId,
          reason: `Automatic expiry of EARN lot ${lot.id}`,
        },
      });

      await tx.customerProfile.update({
        where: { userId: lot.userId },
        data: { pointsBalance: balanceAfter },
      });

      totalPointsExpired += pointsToDeduct;
      expiredLotsProcessed += 1;
      usersAffected.add(lot.userId);
    });
  }

  return {
    expiredLotsProcessed,
    totalPointsExpired,
    usersAffected: usersAffected.size,
  };
}
