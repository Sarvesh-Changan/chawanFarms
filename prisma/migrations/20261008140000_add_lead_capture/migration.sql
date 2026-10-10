ALTER TABLE "Lead"
  ADD COLUMN "firstUtmSource" TEXT,
  ADD COLUMN "firstUtmMedium" TEXT,
  ADD COLUMN "firstUtmCampaign" TEXT,
  ADD COLUMN "firstUtmTerm" TEXT,
  ADD COLUMN "firstUtmContent" TEXT,
  ADD COLUMN "lastReferrer" TEXT;

ALTER TABLE "Enquiry"
  ADD COLUMN "groupSize" INTEGER,
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Enquiry_idempotencyKey_key" ON "Enquiry"("idempotencyKey");
CREATE SEQUENCE "enquiry_reference_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;
