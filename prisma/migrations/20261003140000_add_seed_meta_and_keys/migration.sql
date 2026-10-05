-- Add source metadata and deterministic seed identities without changing existing rows.

ALTER TABLE "Accommodation" ADD COLUMN "meta" JSONB;
ALTER TABLE "Package" ADD COLUMN "meta" JSONB;
ALTER TABLE "PackageRate" ADD COLUMN "seedKey" TEXT;
ALTER TABLE "PackageRate" ADD COLUMN "meta" JSONB;
ALTER TABLE "Activity" ADD COLUMN "meta" JSONB;
ALTER TABLE "MenuCategory" ADD COLUMN "seedKey" TEXT;
ALTER TABLE "MenuCategory" ADD COLUMN "meta" JSONB;
ALTER TABLE "MenuItem" ADD COLUMN "seedKey" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "meta" JSONB;
ALTER TABLE "PolicyVersion" ADD COLUMN "meta" JSONB;
ALTER TABLE "RewardRule" ADD COLUMN "meta" JSONB;
ALTER TABLE "Setting" ADD COLUMN "meta" JSONB;

CREATE UNIQUE INDEX "PackageRate_seedKey_key" ON "PackageRate"("seedKey");
CREATE UNIQUE INDEX "MenuCategory_seedKey_key" ON "MenuCategory"("seedKey");
CREATE UNIQUE INDEX "MenuItem_seedKey_key" ON "MenuItem"("seedKey");
