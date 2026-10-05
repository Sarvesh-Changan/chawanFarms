-- Reward and audit invariants that cannot be expressed in the Prisma schema.

CREATE UNIQUE INDEX "one_earn_per_video"
ON "PointsLedger" ("videoSubmissionId")
WHERE "type" = 'EARN';

CREATE UNIQUE INDEX "one_active_reward_rule"
ON "RewardRule" ("isActive")
WHERE "isActive";

ALTER TABLE "PointsLedger"
  ADD CONSTRAINT "points_ledger_signs_check"
  CHECK (
    ("type" = 'EARN' AND "points" > 0)
    OR ("type" IN ('REDEEM', 'EXPIRE') AND "points" < 0)
    OR "type" IN ('ADJUST', 'REVERSE')
  );

ALTER TABLE "PointsLedger"
  ADD CONSTRAINT "points_ledger_reason_check"
  CHECK (
    "type" NOT IN ('ADJUST', 'REVERSE')
    OR ("reason" IS NOT NULL AND "actorId" IS NOT NULL)
  );

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_dates_and_amounts_check"
  CHECK (
    "checkOut" > "checkIn"
    AND "adults" >= 1
    AND "totalPaise" >= 0
    AND "discountPaise" <= "subtotalPaise"
  );

ALTER TABLE "AvailabilityDay"
  ADD CONSTRAINT "availability_counters_check"
  CHECK (
    ("held" >= 0 AND "booked" >= 0 AND "held" + "booked" <= "capacity")
    OR "isBlocked"
  );

ALTER TABLE "Review"
  ADD CONSTRAINT "review_rating_check"
  CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "CustomerProfile"
  ADD CONSTRAINT "balance_non_negative"
  CHECK ("pointsBalance" >= 0);

CREATE OR REPLACE FUNCTION forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: %', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "points_ledger_immutable"
BEFORE UPDATE OR DELETE ON "PointsLedger"
FOR EACH ROW
EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER "audit_log_immutable"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION forbid_mutation();
