import "server-only";

import { db } from "@/server/db";

export async function processExpiredCoupons(asOf = new Date()): Promise<{ expired: number }> {
  const result = await db.coupon.updateMany({ where: { status: "ACTIVE", expiresAt: { lte: asOf } }, data: { status: "EXPIRED" } });
  return { expired: result.count };
}
