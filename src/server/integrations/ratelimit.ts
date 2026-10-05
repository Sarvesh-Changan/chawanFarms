import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

const limitInputSchema = z.object({
  key: z.string().trim().min(1).max(512).regex(/^[a-zA-Z0-9:_@.+-]+$/),
  max: z.number().int().positive().max(1_000_000),
  windowSeconds: z.number().int().positive().max(86_400),
}).strict();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function limit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const input = limitInputSchema.parse({ key, max, windowSeconds });
  const now = Date.now();
  const windowStart = new Date(
    Math.floor(now / (input.windowSeconds * 1000)) * input.windowSeconds * 1000,
  );
  const rows = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("id", "key", "windowStart", "count")
    VALUES (${randomUUID()}, ${input.key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"
  `);
  const count = rows[0]?.count;

  if (count === undefined) {
    throw new Error("Rate limit bucket was not returned by PostgreSQL.");
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(
      (windowStart.getTime() + input.windowSeconds * 1000 - now) / 1000,
    ),
  );

  return {
    allowed: count <= input.max,
    remaining: Math.max(0, input.max - count),
    retryAfterSeconds,
  };
}
