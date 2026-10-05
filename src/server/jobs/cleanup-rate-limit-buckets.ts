import "server-only";

import { z } from "zod";

import { db } from "@/server/db";

const cleanupOptionsSchema = z.object({
  olderThanSeconds: z.number().int().positive().max(604_800).default(86_400),
}).strict();

export async function deleteExpiredRateLimitBuckets(
  options: { olderThanSeconds?: number } = {},
): Promise<number> {
  const { olderThanSeconds } = cleanupOptionsSchema.parse(options);
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
  const result = await db.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return result.count;
}
