-- AlterTable: add eligibility flags to RewardTier
ALTER TABLE "RewardTier" ADD COLUMN IF NOT EXISTS "allPackages" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RewardTier" ADD COLUMN IF NOT EXISTS "allAccommodation" BOOLEAN NOT NULL DEFAULT true;
