-- Store the requested publication instant for scheduled accommodation content.
ALTER TABLE "Accommodation" ADD COLUMN "publishAt" TIMESTAMP(3);

CREATE INDEX "Accommodation_status_publishAt_idx" ON "Accommodation"("status", "publishAt");
