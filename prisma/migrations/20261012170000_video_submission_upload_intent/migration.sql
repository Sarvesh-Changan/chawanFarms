-- Allow a customer video submission to reserve an upload identity before a
-- Cloudinary asset exists, while keeping the eventual media link restricted.
ALTER TABLE "VideoSubmission"
  ALTER COLUMN "mediaId" DROP NOT NULL,
  ADD COLUMN "uploadPublicId" TEXT,
  ADD COLUMN "uploadExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "VideoSubmission_uploadPublicId_key"
  ON "VideoSubmission"("uploadPublicId");

ALTER TABLE "VideoSubmission"
  ADD CONSTRAINT "VideoSubmission_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
