-- Persist the ordered gallery of approved media IDs for each accommodation.
ALTER TABLE "Accommodation" ADD COLUMN "imageMediaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
