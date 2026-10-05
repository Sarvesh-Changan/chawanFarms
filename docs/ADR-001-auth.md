# ADR-001: Authentication library

- Status: Proposed — awaiting client confirmation
- Date: 2026-10-03
- Decision: Better Auth with its Prisma adapter

## Context

`SECURITY.md` §2 requires an established library, strong password hashing, verified email before booking/reward actions, single-use short-lived reset/verification tokens, revocable database sessions, and TOTP 2FA for privileged staff. The application uses Next.js App Router and Prisma/PostgreSQL is the planned database stack. No authentication package or Prisma schema is installed yet.

## Current documentation comparison

| Requirement | Better Auth | Auth.js / NextAuth v5 |
|---|---|---|
| Next.js App Router | Official Next.js example and route-handler integration; compatible with App Router. | App Router-first; exports `handlers`, `auth`, `signIn`, and `signOut` from `auth.ts`, consumed by an App Router route handler. |
| Prisma | Official `@better-auth/prisma-adapter`; `auth generate` generates the ORM schema and Prisma applies migrations. | Official `@auth/prisma-adapter`; Prisma schema and migrations are supported. |
| Email/password | Built in. Default password hashing is scrypt; Argon2id can be configured. Configure minimum length to 10. | Credentials provider only forwards input to an application `authorize` function. The docs explicitly leave password persistence, hashing, rate limits, and password reset to the application. |
| Email verification | Built in; `requireEmailVerification` prevents a session until verified and duplicate sign-up responses can be made generic. Configure a 24-hour-or-less expiry. | The Email provider is passwordless/magic-link authentication, not email/password verification. Verification for a Credentials flow would be application code. |
| Password reset | Built in through `sendResetPassword`; configure a 30-minute-or-less expiry and revoke other sessions on reset. | No built-in password reset flow for Credentials; application code is required. |
| Database sessions | Database-backed `session` table and opaque cookie session identifier; suitable for revocation and “sign out all devices”. Keep cookie caching disabled or short where immediate revocation matters. | Database strategy is supported with an adapter and is the default when an adapter is configured. It supports server-side revocation. |
| 2FA | First-party `twoFactor` plugin supports TOTP, backup codes, challenge handling, and lockout. | Current official docs list Credentials, OAuth, email/magic links, and experimental WebAuthn/passkeys; they do not provide a first-party TOTP flow. TOTP would require another integration or custom security-sensitive code. |
| Fit with `SECURITY.md` §2 | Meets the library-only requirement, subject to the configuration gates below. | Fails the library-only requirement for this scope because the requested password, reset, verification, and TOTP controls would have to be implemented around the library. |

## Decision

Use Better Auth and its Prisma adapter. Configure it in the implementation phase with, at minimum:

- email/password enabled;
- minimum password length 10, with no composition-rule requirement;
- `requireEmailVerification: true`;
- verification expiry no longer than 24 hours;
- reset-token expiry no longer than 30 minutes;
- `revokeSessionsOnPasswordReset: true`;
- hashed verification-token storage (`verification.storeIdentifier: "hashed"`) and single-use consumption;
- database sessions, secure/httpOnly/SameSite=Lax cookies, and no long-lived cookie cache for privileged actions;
- the `twoFactor` plugin for staff TOTP, with backup-code protection and server-side enforcement;
- application-level per-IP and per-account rate limits, progressive lockout, Turnstile escalation, invitation-only staff creation, and the existing database RBAC/audit rules.

The library cannot by itself implement every project policy. Session idle/absolute limits that differ for customers and admins, authorization, admin invitation rules, audit events, Turnstile, and the exact rate-limit policy remain application responsibilities and must be enforced on the server.

## Required Prisma models/tables

For the selected Better Auth configuration, the exact core models are:

| Prisma model | Physical table | Purpose |
|---|---|---|
| `User` | `user` | Identity, name, email, verification state, timestamps |
| `Session` | `session` | User-linked, unique session token, expiry, IP/user-agent, timestamps |
| `Account` | `account` | Credential account (`providerId = "credential"`) and future OAuth accounts; password hash is stored here by Better Auth |
| `Verification` | `verification` | Email verification and password-reset verification records with expiry |

With the required TOTP plugin, add:

| Prisma model | Physical table/column | Purpose |
|---|---|---|
| `TwoFactor` | `twoFactor` | User-linked TOTP secret, backup codes, enrollment state, and failed-verification lockout fields |
| `User.twoFactorEnabled` | `user.twoFactorEnabled` | Whether TOTP is enabled for the user |

The names above are the current Better Auth defaults. Better Auth permits mapped names, but the generated schema must be reviewed and kept compatible with the chosen configuration. `VerificationToken` is the Auth.js model name and is not part of the Better Auth schema.

## Consequences and acceptance gates

Better Auth reduces custom security code and supplies the requested feature set, at the cost of adopting its schema generator, plugin conventions, and email-provider integration. Before production, the implementation must verify generated Prisma SQL, token hashing/single-use behavior, cookie attributes, role-specific session expiry, session revocation, rate limits, generic reset responses, and TOTP lockout with security tests. No package installation or schema change is part of this ADR.

## Sources checked on 2026-10-03

- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth database schema](https://better-auth.com/docs/concepts/database)
- [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth security](https://better-auth.com/docs/reference/security)
- [Better Auth options](https://better-auth.com/docs/reference/options)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth 2FA plugin](https://better-auth.com/docs/plugins/2fa)
- [Better Auth Next.js example](https://better-auth.com/docs/examples/next-js)
- [Auth.js Prisma adapter](https://authjs.dev/getting-started/adapters/prisma)
- [Auth.js Credentials provider](https://authjs.dev/getting-started/authentication/credentials)
- [Auth.js Email provider](https://authjs.dev/getting-started/authentication/email)
- [Auth.js session strategies](https://authjs.dev/concepts/session-strategies)
- [Auth.js v5 upgrade guide](https://authjs.dev/getting-started/migrating-to-v5)
