import "server-only";

/**
 * RECONCILIATION JOB — Compares SUM(PointsLedger.points) vs CustomerProfile.pointsBalance.
 * Alerts on drift between immutable ledger rows and cached customer profile totals.
 */

import { db } from "@/server/db";

export type ProfileDriftReport = {
  userId: string;
  cachedPointsBalance: number;
  ledgerSumPoints: number;
  balanceDrift: number;
  cachedLifetimeEarned: number;
  ledgerEarnSum: number;
  lifetimeDrift: number;
};

export type ReconciliationSummary = {
  profilesChecked: number;
  driftCount: number;
  drifts: ProfileDriftReport[];
  timestamp: string;
};

export async function reconcileCustomerPointsBalances(): Promise<ReconciliationSummary> {
  const drifts: ProfileDriftReport[] = [];

  // 1. Fetch all customer profiles with cached values
  const profiles = await db.customerProfile.findMany({
    select: {
      userId: true,
      pointsBalance: true,
      lifetimePointsEarned: true,
    },
  });

  // 2. Aggregate actual sums from PointsLedger using GROUP BY
  const balanceAggregates = await db.pointsLedger.groupBy({
    by: ["userId"],
    _sum: {
      points: true,
    },
  });

  const earnAggregates = await db.pointsLedger.groupBy({
    by: ["userId"],
    where: { type: "EARN" },
    _sum: {
      points: true,
    },
  });

  const balanceMap = new Map<string, number>();
  for (const row of balanceAggregates) {
    balanceMap.set(row.userId, row._sum.points ?? 0);
  }

  const earnMap = new Map<string, number>();
  for (const row of earnAggregates) {
    earnMap.set(row.userId, row._sum.points ?? 0);
  }

  for (const profile of profiles) {
    const ledgerSum = balanceMap.get(profile.userId) ?? 0;
    const ledgerEarn = earnMap.get(profile.userId) ?? 0;

    const balanceDrift = profile.pointsBalance - ledgerSum;
    const lifetimeDrift = profile.lifetimePointsEarned - ledgerEarn;

    if (balanceDrift !== 0 || lifetimeDrift !== 0) {
      drifts.push({
        userId: profile.userId,
        cachedPointsBalance: profile.pointsBalance,
        ledgerSumPoints: ledgerSum,
        balanceDrift,
        cachedLifetimeEarned: profile.lifetimePointsEarned,
        ledgerEarnSum: ledgerEarn,
        lifetimeDrift,
      });

      console.warn(
        `[REWARD_DRIFT_ALERT] Customer ${profile.userId} has point drift! ` +
          `Balance cached: ${profile.pointsBalance}, ledger sum: ${ledgerSum} (drift: ${balanceDrift}). ` +
          `Lifetime cached: ${profile.lifetimePointsEarned}, ledger earn: ${ledgerEarn} (drift: ${lifetimeDrift}).`,
      );
    }
  }

  return {
    profilesChecked: profiles.length,
    driftCount: drifts.length,
    drifts,
    timestamp: new Date().toISOString(),
  };
}
