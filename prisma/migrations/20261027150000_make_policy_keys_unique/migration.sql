-- Keep one current policy row per key and merge existing historical rows.
CREATE TEMP TABLE "_PolicyVersionCanonical" AS
SELECT DISTINCT ON ("key") "key", "id" AS "canonicalId"
FROM "PolicyVersion"
ORDER BY
  "key",
  CASE WHEN "status" = 'PUBLISHED' THEN 0 ELSE 1 END,
  "version" DESC,
  "publishedAt" DESC NULLS LAST,
  "id";

CREATE TEMP TABLE "_PolicyVersionDuplicates" AS
SELECT pv."id", canonical."canonicalId"
FROM "PolicyVersion" pv
JOIN "_PolicyVersionCanonical" canonical ON canonical."key" = pv."key"
WHERE pv."id" <> canonical."canonicalId";

-- Avoid duplicate booking/key acceptances while moving references to the retained row.
DELETE FROM "PolicyAcceptance" acceptance
USING "_PolicyVersionDuplicates" duplicate
WHERE acceptance."policyVersionId" = duplicate."id"
  AND EXISTS (
    SELECT 1
    FROM "PolicyAcceptance" existing
    WHERE existing."bookingId" = acceptance."bookingId"
      AND existing."policyVersionId" = duplicate."canonicalId"
  );

UPDATE "PolicyAcceptance" acceptance
SET "policyVersionId" = duplicate."canonicalId"
FROM "_PolicyVersionDuplicates" duplicate
WHERE acceptance."policyVersionId" = duplicate."id";

DELETE FROM "PolicyVersion" policy
USING "_PolicyVersionDuplicates" duplicate
WHERE policy."id" = duplicate."id";

DROP INDEX "PolicyVersion_key_version_key";
CREATE UNIQUE INDEX "PolicyVersion_key_key" ON "PolicyVersion"("key");

DROP TABLE "_PolicyVersionDuplicates";
DROP TABLE "_PolicyVersionCanonical";
