-- AlterTable
ALTER TABLE "CouponRedemption" ADD COLUMN "releasedAt" TIMESTAMP(3);
ALTER TABLE "CouponRedemption" ADD COLUMN "releaseReason" TEXT;

-- DropIndex
DROP INDEX "CouponRedemption_couponId_key";

-- CreateIndex: Partial unique index on couponId WHERE releasedAt IS NULL
CREATE UNIQUE INDEX "CouponRedemption_couponId_active_unique" ON "CouponRedemption"("couponId") WHERE "releasedAt" IS NULL;

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateEnum
CREATE TYPE "PointsAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PointsAdjustmentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "PointsAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "ledgerEntryId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointsAdjustmentRequest_ledgerEntryId_key" ON "PointsAdjustmentRequest"("ledgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PointsAdjustmentRequest_idempotencyKey_key" ON "PointsAdjustmentRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PointsAdjustmentRequest_status_createdAt_idx" ON "PointsAdjustmentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PointsAdjustmentRequest_userId_status_idx" ON "PointsAdjustmentRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "PointsAdjustmentRequest" ADD CONSTRAINT "PointsAdjustmentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsAdjustmentRequest" ADD CONSTRAINT "PointsAdjustmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsAdjustmentRequest" ADD CONSTRAINT "PointsAdjustmentRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsAdjustmentRequest" ADD CONSTRAINT "PointsAdjustmentRequest_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "PointsLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
