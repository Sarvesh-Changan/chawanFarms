CREATE TABLE "SavedFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedFilter_userId_scope_name_key" ON "SavedFilter"("userId", "scope", "name");
CREATE INDEX "SavedFilter_userId_scope_createdAt_idx" ON "SavedFilter"("userId", "scope", "createdAt");

ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "RolePermission" AS rp
USING "Role" AS role, "Permission" AS permission
WHERE rp."roleId" = role."id"
  AND rp."permissionId" = permission."id"
  AND role."name" = 'Reservations'
  AND permission."key" = 'leads.export';
