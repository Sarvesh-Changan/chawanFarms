-- AlterTable: Add idempotencyKey to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateIndex: Unique index on Booking.idempotencyKey
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- Replace Booking check constraint to allow day visits (checkOut >= checkIn and nights >= 0)
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_dates_and_amounts_check";

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_dates_and_amounts_check"
  CHECK (
    "checkOut" >= "checkIn"
    AND "nights" >= 0
    AND "adults" >= 1
    AND "totalPaise" >= 0
    AND "discountPaise" <= "subtotalPaise"
  );

-- Update AvailabilityDay check constraint for unconstrained/zero capacity
ALTER TABLE "AvailabilityDay" DROP CONSTRAINT IF EXISTS "availability_counters_check";

ALTER TABLE "AvailabilityDay"
  ADD CONSTRAINT "availability_counters_check"
  CHECK (
    ("held" >= 0 AND "booked" >= 0 AND ("capacity" <= 0 OR "held" + "booked" <= "capacity"))
    OR "isBlocked"
  );

-- Sequence for race-safe booking reference generation BKG-YYYY-NNNNNN
CREATE SEQUENCE IF NOT EXISTS booking_reference_seq START 1;
