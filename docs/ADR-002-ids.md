# ADR-002: Primary-key identifier format

- Status: Proposed — awaiting client confirmation
- Date: 2026-10-03
- Decision: UUID v4 for internal primary keys and their foreign keys

## Context

`DATABASE.md` currently leaves the choice between `cuid()` and `uuid()` open, while its reference schema uses CUID examples. The database target is PostgreSQL on Neon, the schema has not been created, and identifiers will appear in server routes, logs, relations, and some customer-facing URLs. Identifiers are not an authorization control; every resource still requires server-side ownership and permission checks.

## Decision

Use UUID v4 consistently for application primary keys and matching foreign keys, including the Better Auth models. Use separate slugs or references where a human-readable URL or booking reference is required.

## Reasons

- PostgreSQL has a native, compact UUID type and mature indexing/tooling support.
- UUID v4 is opaque and does not expose the approximate creation time that CUID-style identifiers can reveal.
- UUID is broadly interoperable with external services and future integrations.
- The database is not yet established, so adopting UUID does not require a migration of live data.
- Better Auth supports UUID ID generation, and Auth.js/Prisma schemas use string identifiers, so either library can be aligned with this decision.

## Trade-offs and rules

- UUIDs are less human-friendly and do not provide creation ordering. Use `createdAt` for ordering and dedicated slugs/references for presentation.
- All related IDs must use the same UUID representation; do not mix CUID and UUID across foreign-key families.
- UUIDs must never be treated as authorization. Continue to scope queries by the authenticated user/tenant and return 404 for inaccessible customer resources as required by `SECURITY.md`.
- Session tokens, reset tokens, verification tokens, and other secrets remain library-generated opaque values; this ADR does not replace their hashing, expiry, or revocation requirements.

## Consequence for existing drafts

This ADR supersedes the provisional `cuid()` defaults in `DATABASE.md` once confirmed. The later Prisma-schema phase must update all domain models, foreign keys, seed assumptions, and the selected auth-library schema together. This ADR makes no schema or database change.

## Sources checked on 2026-10-03

- [Better Auth database options and ID generation](https://better-auth.com/docs/reference/options)
- [Auth.js Prisma schema](https://authjs.dev/getting-started/adapters/prisma)
