-- stories_unify
-- Non-destructive: Experience, Post, VideoSubmission and customer Media rows are never deleted or renamed.

CREATE TYPE "StoryKind" AS ENUM ('EXPERIENCE', 'STORY', 'GUEST');

ALTER TABLE "Post"
  ADD COLUMN "kind" "StoryKind" NOT NULL DEFAULT 'STORY',
  ADD COLUMN "videoMediaId" TEXT,
  ADD COLUMN "sourceSubmissionId" TEXT,
  ADD COLUMN "sourceExperienceId" TEXT,
  ADD COLUMN "photoMediaIds" JSONB,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Post_sourceSubmissionId_key" ON "Post"("sourceSubmissionId");
CREATE UNIQUE INDEX "Post_sourceExperienceId_key" ON "Post"("sourceExperienceId");
CREATE INDEX "Post_kind_status_sortOrder_idx" ON "Post"("kind", "status", "sortOrder");

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_videoMediaId_fkey"
    FOREIGN KEY ("videoMediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Post_sourceSubmissionId_fkey"
    FOREIGN KEY ("sourceSubmissionId") REFERENCES "VideoSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dry-run count: this NOTICE is emitted before any Experience copy is inserted.
DO $$
DECLARE
  copy_count INTEGER;
BEGIN
  SELECT count(*) INTO copy_count
  FROM "Experience" e
  WHERE NOT EXISTS (
    SELECT 1 FROM "Post" p WHERE p."sourceExperienceId" = e."id"
  );
  RAISE NOTICE 'stories_unify dry-run: % Experience row(s) would be copied into Post', copy_count;
END $$;

-- Idempotent copy. A sourceExperienceId marks a completed copy. Slug collisions are
-- resolved deterministically without altering the original Experience slug.
DO $$
DECLARE
  source_row RECORD;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR source_row IN
    SELECT e.*
    FROM "Experience" e
    WHERE NOT EXISTS (
      SELECT 1 FROM "Post" p WHERE p."sourceExperienceId" = e."id"
    )
    ORDER BY e."createdAt", e."id"
  LOOP
    candidate := source_row."slug";
    suffix := 0;
    WHILE EXISTS (SELECT 1 FROM "Post" p WHERE p."slug" = candidate) LOOP
      suffix := suffix + 1;
      candidate := source_row."slug" || '-experience' || CASE WHEN suffix = 1 THEN '' ELSE '-' || suffix::TEXT END;
    END LOOP;

    INSERT INTO "Post" (
      "id", "slug", "title", "excerpt", "body", "coverMediaId", "kind",
      "sourceExperienceId", "sortOrder", "status", "publishAt", "deletedAt",
      "createdAt", "updatedAt"
    ) VALUES (
      md5(source_row."id" || ':stories_unify'), candidate, source_row."title",
      source_row."summary", COALESCE(source_row."body", '{}'::jsonb),
      source_row."heroMediaId", 'EXPERIENCE', source_row."id", source_row."sortOrder",
      source_row."status", source_row."publishAt", source_row."deletedAt",
      source_row."createdAt", source_row."updatedAt"
    );

    IF source_row."heroMediaId" IS NOT NULL THEN
      INSERT INTO "MediaUsage" ("id", "mediaId", "entityType", "entityId", "field")
      SELECT md5(source_row."id" || ':stories_unify:cover'), source_row."heroMediaId", 'Post', md5(source_row."id" || ':stories_unify'), 'cover'
      WHERE NOT EXISTS (
        SELECT 1 FROM "MediaUsage" u
        WHERE u."mediaId" = source_row."heroMediaId"
          AND u."entityType" = 'Post'
          AND u."entityId" = md5(source_row."id" || ':stories_unify')
          AND u."field" = 'cover'
      );
    END IF;
  END LOOP;
END $$;

