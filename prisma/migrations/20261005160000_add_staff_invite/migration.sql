CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleIds" TEXT[] NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StaffInvite_email_lowercase_check" CHECK ("email" = lower("email"))
);

CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");
CREATE INDEX "StaffInvite_email_idx" ON "StaffInvite"("email");
CREATE INDEX "StaffInvite_invitedById_createdAt_idx" ON "StaffInvite"("invitedById", "createdAt");
CREATE UNIQUE INDEX one_pending_invite_per_email ON "StaffInvite" (lower("email")) WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "StaffInvite"
ADD CONSTRAINT "StaffInvite_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
