-- Add account lockout state and the PostgreSQL-backed rate-limit buckets.

ALTER TABLE "user"
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE TABLE "RateLimitBucket" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimitBucket_key_windowStart_key"
  ON "RateLimitBucket"("key", "windowStart");

CREATE INDEX "RateLimitBucket_windowStart_idx"
  ON "RateLimitBucket"("windowStart");
