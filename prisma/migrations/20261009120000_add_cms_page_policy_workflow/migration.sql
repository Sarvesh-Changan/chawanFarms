-- Policy versions need an explicit unpublished state; historical versions default to draft for safety.
ALTER TABLE "PolicyVersion"
  ADD COLUMN "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  ALTER COLUMN "publishedAt" DROP NOT NULL,
  ALTER COLUMN "publishedAt" DROP DEFAULT;

CREATE INDEX "PolicyVersion_status_key_idx" ON "PolicyVersion"("status", "key");

ALTER TABLE "Page" ADD COLUMN "meta" JSONB;
