# Official Super Admin Bootstrap & Production Runbook

This guide covers bootstrapping the official Super Admin account (`chawanfarms123@gmail.com`), hardening password authentication, and verifying the staff email OTP password reset flow for production deployment on Chawan Farms.

> [!IMPORTANT]
> **Zero Hardcoded Production Credentials**:
> - Never pass passwords via CLI flags, environment variables, or configuration files.
> - The bootstrap script prompts interactively with masked input.
> - The production database seed (`prisma/seed.ts`) **never** creates users or accounts.
> - The production environment guard (`--i-know-this-is-production`) is required when running against `APP_ENV=production`.

---

## 1. Prerequisites & Environment Check

Before proceeding, ensure production environment variables are properly configured in Vercel or your hosting provider:

1. `APP_ENV=production`
2. `AUTH_SECRET`: Strong secret with at least 32 characters and high entropy (e.g. generated via `openssl rand -base64 32`).
3. `AUTH_TRUSTED_ORIGINS`: Comma-separated HTTPS origins (e.g. `https://chawanfarms.com,https://www.chawanfarms.com`). No HTTP or localhost origins.
4. `NEXT_PUBLIC_SITE_URL`: Canonical HTTPS URL (e.g. `https://chawanfarms.com`).
5. `DATABASE_URL`: Production PostgreSQL connection string (Neon with connection pooling / pgbouncer).
6. `DIRECT_URL`: Production direct PostgreSQL connection string (for migrations).
7. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Production transactional email credentials.

---

## 2. Step 1: Create a Neon Database Backup Branch

Create an instant point-in-time snapshot of the production database branch before running bootstrap scripts:

### Option A: Using the Neon CLI
```bash
# Install Neon CLI if not already installed
npm install -g neonctl

# Authenticate
neonctl auth

# Create a snapshot branch from your production branch (e.g., 'main')
neonctl branches create --name pre-admin-bootstrap-backup --parent main
```

### Option B: Using the Neon Web Console
1. Navigate to the **Neon Console** -> Select your Chawan Farms project.
2. Go to **Branches** -> Click **New Branch**.
3. Set **Branch Name** to `pre-admin-bootstrap-backup`.
4. Set **Parent branch** to `main` (or your active production branch).
5. Click **Create Branch**.

---

## 3. Step 2: Database Schema & Migrations

> [!NOTE]
> **No Schema Migration Required for This Release**:
> The staff OTP password reset flow and login hardening utilize the existing Prisma schema tables:
> - `Verification`: Stores hashed OTP codes and single-use reset grants with TTLs.
> - `User`: Stores user record, lockout counters (`failedLoginCount`, `lockedUntil`), and `type = "STAFF"`.
> - `Account`: Stores scrypt password hashes (`providerId = "credential"`).
> - `Session`: Tracks DB-backed sessions with sliding idle and absolute timeouts.
> - `AuditLog`: Logs all admin creations, password resets, and role promotions.

If you have any pending migrations from earlier releases, deploy them using:
```bash
npx prisma migrate deploy
```

---

## 4. Step 3: Create or Promote the Official Super Admin

Run the interactive bootstrap script. **Do not run this with automated flags or environment variables containing passwords.**

```bash
# In production (requires explicit --i-know-this-is-production flag)
npm run admin:create -- --i-know-this-is-production
```

### Interactive Prompts:
1. **Target email address**: Enter `chawanfarms123@gmail.com`.
2. **Account password**: Enter a strong password when prompted (input is hidden).
3. **Confirm password**: Re-enter the password to confirm.

### Password Policy Enforced:
- Minimum 12 characters, maximum 128 characters.
- Rejects the top 1,000 most common passwords.
- Rejects passwords containing the local part of the email address (`chawanfarms123`).
- Allows spaces and Unicode characters (passphrases strongly recommended).

### Resetting an Existing Account:
If `chawanfarms123@gmail.com` was previously created and you need to reset its password or elevate it to Super Admin:
```bash
npm run admin:create -- --i-know-this-is-production --reset-password
```
The script will prompt for interactive confirmation (`type "yes"`) before updating the account.

---

## 5. Step 4: First Login & Enroll 2FA (TOTP)

1. Open a browser and navigate to the admin login page:
   `https://chawanfarms.com/login?callbackUrl=/admin`
2. Enter `chawanfarms123@gmail.com` and your new password.
3. Upon first login, staff accounts with the Super Admin role must enroll in Two-Factor Authentication.
4. Navigate to:
   `https://chawanfarms.com/admin/security/two-factor`
5. Scan the QR code using your authenticator app (Google Authenticator, 1Password, Bitwarden, Authy, etc.).
6. Enter the 6-digit TOTP code to confirm enrollment and save backup recovery codes securely.

---

## 6. Step 5: Verify the Staff Email OTP Password Reset Flow

Test the self-service staff password reset flow in production:

1. Navigate to:
   `https://chawanfarms.com/forgot-password?role=admin`
2. Enter `chawanfarms123@gmail.com` and submit.
3. Confirm that the UI displays the neutral confirmation message:
   > *"If an eligible staff account exists for this email, a 6-digit verification code has been sent."*
4. Check the inbox of `chawanfarms123@gmail.com` for the email:
   - Subject: *"Your Chawan Farms verification code"*
   - Sender: Configured `SMTP_FROM` address.
   - Contains a 6-digit numeric OTP code valid for 10 minutes.
5. Enter the 6-digit code on the reset page.
6. Enter a new strong password satisfying the 12+ character policy.
7. Upon successful reset:
   - All active sessions are immediately revoked across all devices.
   - An email notification is sent to `chawanfarms123@gmail.com` confirming the password was changed.
   - An audit log entry (`auth.staff_password_reset`) is recorded.
8. Verify that logging in with the old password fails, and logging in with the new password requires TOTP verification.

---

## 7. Rollback Plan

If unexpected issues occur during deployment or bootstrap:

### 1. Database Rollback via Neon
Point the production connection string back to the snapshot branch created in Step 1 (`pre-admin-bootstrap-backup`), or restore the parent branch from that snapshot in the Neon console.

### 2. Emergency Account Suspension
If the Super Admin account credentials are compromised or need to be revoked immediately:
```sql
-- Revoke all active sessions immediately
DELETE FROM "Session"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'chawanfarms123@gmail.com');

-- Suspend account access
UPDATE "User"
SET "status" = 'SUSPENDED',
    "lockedUntil" = NOW() + INTERVAL '30 days'
WHERE "email" = 'chawanfarms123@gmail.com';
```

### 3. Application Code Rollback
If application rollback is necessary, revert to the previous Git deployment in Vercel:
1. Go to **Vercel Dashboard** -> **Deployments**.
2. Locate the previous production deployment.
3. Click **Instant Rollback**.

