# CODING_STANDARDS — Chawan Farms Platform

> Binding for humans and AI agents. When unsure, choose the simpler, safer, more explicit option. Always check the installed library's current docs before using an API.

## 1. TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes` where practical, `noImplicitOverride`. No `any` (use `unknown` + narrowing); `@ts-expect-error` only with comment + ticket. No non-null `!` except in tests.
- Prefer `type` for unions/props, `interface` for extendable object contracts. Use `as const` + `satisfies`. Derive types from Zod (`z.infer`) and Prisma (`Prisma.XGetPayload`) — don't duplicate shapes.
- Enums: Prisma enums mirrored via generated types; for UI use string-literal unions.
- Money is `number` of **paise integers** with helper `formatINR(paise)`; never floating arithmetic on currency; percent maths via integer rounding helper (`Math.round`, documented rounding rule, unit tested).
- Dates: `Date` in UTC; helpers in `lib/dates.ts` (Asia/Kolkata); stay dates handled as `YYYY-MM-DD` strings at boundaries.
- Result pattern for expected failures: `type Result<T> = {ok:true,data:T} | {ok:false,error:{code:ErrorCode,message:string,fieldErrors?:Record<string,string[]>}}`. Throw only for unexpected/programmer errors.

## 2. Next.js standards
- App Router only. Route groups `(public)`, `(auth)`; protected trees `account/`, `admin/`.
- **Server Components by default.** Add `"use client"` only for state, effects, browser APIs, event handlers. Push client boundaries to leaf components. Never import server-only modules (`db`, `authz`, secrets) into client code — mark with `import "server-only"`.
- Data fetching in Server Components via services (not via internal HTTP calls). Use `Suspense` + `loading.tsx` for streaming; `error.tsx` per segment; `not-found.tsx`; `generateMetadata` for SEO on every public route.
- Caching: explicit. Tag every cached read; admin writes call `revalidateTag`/`revalidatePath`. Follow the installed Next.js version's caching semantics (they changed between majors — read docs).
- Images via `next/image` (or `next-cloudinary`) with `sizes`; fonts via `next/font`; scripts via `next/script` with strategy; links via `next/link`.
- Forms: `<form action={serverAction}>` with progressive enhancement, `useActionState` for state, `useFormStatus` for pending.
- Environment: access only through `config/env.ts`. No `process.env` elsewhere.
- No business logic in `page.tsx`/`layout.tsx`; they compose components and call services.

## 3. Component structure & naming
```
components/<domain>/<ComponentName>/
  ComponentName.tsx        # presentational/composition
  ComponentName.client.tsx # only if needs "use client"
  ComponentName.test.tsx
  index.ts                 # optional barrel (avoid deep barrels for tree-shaking)
```
- One exported component per file; props typed `ComponentNameProps`; no prop drilling >2 levels (use composition/context sparingly).
- Style with Tailwind utility classes + `cn()`; variants via `class-variance-authority`; tokens from CSS variables (no raw hex in components).
- Accessible by default: semantic HTML, labelled controls, focus states, keyboard handlers.
- Animations in dedicated `components/motion/*` wrappers (lazy, reduced-motion aware).

## 4. Server actions & route handlers
- Standard pipeline (ARCHITECTURE §6): rate-limit → auth → authz → validate → (bot check) → service → audit → revalidate → typed result.
- File per domain: `server/actions/<domain>.ts` with `"use server"`; export only async actions; never export helpers from "use server" files.
- Actions are public endpoints: never trust arguments; re-fetch entities by id with ownership filter.
- Idempotency: mutating actions that can be double-submitted accept/derive an idempotency key (booking submit, ledger writes, coupon redeem).
- Route handlers: validate method, content-type, size; return `NextResponse.json` with correct status; never leak stack traces.
- Naming: `createX`, `updateX`, `publishX`, `approveVideo`, etc. Verbs describe domain intent.

## 5. Prisma & database access
- Single client in `server/db.ts` (singleton, handles dev hot reload). Access DB **only** from `server/**` (services/repositories). UI never imports Prisma.
- Always `select` only needed fields for lists; paginate (cursor for infinite, offset for admin tables with max page size 100); no unbounded `findMany`.
- Use transactions (`$transaction`) for multi-write invariants; interactive transactions short; set explicit isolation where specified; row locks via `$queryRaw` tagged templates.
- Never `$queryRawUnsafe`. Never build SQL strings.
- Soft-delete: central query helpers/extension that add `deletedAt: null`; admin "trash" views opt in explicitly.
- Money & points arithmetic in integers; avoid read-modify-write in app code — use atomic `increment` or locked tx.
- Schema changes only via migrations (`prisma migrate dev`); never `db push` outside throwaway local DBs; no editing applied migrations; raw SQL migrations commented with rationale and tested.
- Seed scripts idempotent; source-tag PDF-derived rows.
- Name conventions: models PascalCase singular, fields camelCase, enums PascalCase with UPPER_SNAKE values, join tables `AB`.

## 6. Services & domain logic
- `server/services/<domain>.ts` own business rules and transactions; `server/policies/*` hold pure rule functions (pricing, eligibility, caps) with 100% unit-test coverage on branches.
- Services accept a typed context (`{actor, ip, requestId}`) so audit logging is uniform.
- No cross-domain DB writes bypassing the owning service (e.g. only `rewards` service touches `PointsLedger`).

## 7. Validation
- Zod schemas in `lib/schemas/<domain>.ts`, shared by client forms and server. `.strict()`, trimmed strings, max lengths on all text, enums/regex for phone (`+91` normalisation), email lowercased, dates validated as real calendar dates, guests counts within bounds.
- Server re-validates everything even if client validated. Return field-level errors for forms.
- Rich text and URLs sanitised/validated per SECURITY.md.

## 8. Error handling & logging
- Typed error codes (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `RATE_LIMITED`, `CONFLICT`, `UNAVAILABLE`, `INTERNAL`). User-facing messages friendly and non-technical; no internals leaked.
- Catch at boundaries; unexpected errors → Sentry + generic message + request id shown to user.
- Logging via a small `logger` (structured JSON); never log secrets, tokens, passwords, full phone/email; use ids.

## 9. Loading, empty & error UX
Every async view has: skeleton (`loading.tsx`/Suspense), empty state with next action, error state with retry. Buttons show pending state and are disabled during submit; optimistic UI only where safe (never for points/prices). Toasts via one system (sonner) with accessible live region.

## 10. Naming & style
- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for components. Hooks `useThing`. Constants `UPPER_SNAKE`. Booleans `isX/hasX/canX`. No abbreviations except common (id, url, seo).
- Imports ordered: node/react → external → `@/` internal → relative; path alias `@/*` → `src/*`. No default exports except Next.js special files.
- Comments explain **why**; TODOs reference an issue id. Dead code deleted, not commented.
- ESLint (next, typescript-eslint strict, jsx-a11y, import, security-minded rules incl. `no-restricted-imports` to keep Prisma out of components) + Prettier (+ tailwind plugin). Zero warnings policy in CI.

## 11. Folder rules (summary; full tree in ARCHITECTURE §4)
`app/` routing only · `components/` UI · `server/` all trusted code · `lib/` pure shared utils & schemas · `config/` env & constants · `tests/` · `prisma/`. Cyclic imports forbidden. Client components may import from `lib/` and `components/`, never from `server/`.

## 12. Git & workflow
- Trunk-based with short-lived branches: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `test/…`. One phase = one or more small PRs; each PR leaves `main` deployable.
- **Conventional Commits**: `feat(booking): add availability service`. Imperative, ≤ 72 chars subject, body explains why. Reference phase/ticket.
- PR template: summary, phase, screenshots (UI), DB changes, env changes, security impact, test evidence, rollback.
- No force-push to `main`; squash merge; CI required; CODEOWNERS for sensitive paths. Migrations merged with the code that needs them.
- Never commit: `.env*`, secrets, large media, generated Prisma client, `.next`.

## 13. Dependencies
Add only with justification (size, maintenance, license, install scripts). Prefer platform features. Pin versions; update through Renovate/Dependabot PRs with tests. Run `npm audit` in CI. Document each notable dependency in `docs/DEPENDENCIES.md` (why, alternatives).

## 14. Testing standards
| Layer | Tooling | Must cover |
|---|---|---|
| Unit | Vitest | pricing, policies, money/date helpers, zod schemas, state machines, coupon eligibility |
| Integration | Vitest + real Postgres (ephemeral/Docker/Neon branch) | services with DB: booking confirm/overbooking, reward approve/redeem (+ races), ledger immutability trigger, authz matrix, IDOR |
| Component | Testing Library | forms, stepper, upload UI states, a11y (jest-axe) |
| E2E | Playwright (mobile + desktop) | signup→verify→login, enquiry submit, booking request, video upload→admin approve→points→coupon→apply, admin CMS publish→public update |
| Visual/perf | Lighthouse CI, Playwright screenshots (optional) | CWV budgets |
- Test names describe behaviour. Arrange-Act-Assert. Deterministic (fake timers/clock), no network (MSW; Cloudinary/Resend mocked behind interfaces). Each bug fix adds a regression test.
- Coverage targets: policies/services ≥ 90% branches; overall ≥ 70%; **no merging code touching money/points/auth without tests**.
- Definition of done per task: lint ✔ typecheck ✔ tests ✔ build ✔ manual verification steps documented.

## 15. Code review standards
Reviewer checks: (1) matches PRD/ARCHITECTURE/DATABASE/SECURITY; (2) authN/authZ/validation present; (3) no client-trusted values; (4) transactions & idempotency for money/points; (5) no PII/secrets in logs; (6) accessibility & responsive; (7) performance (client JS, images, queries); (8) tests meaningful; (9) migrations safe/reversible-by-forward-fix; (10) no invented client content; (11) docs updated. Small PRs (<~400 changed lines excluding generated). Blocking issues fixed before merge; nitpicks labelled `nit:`.

## 16. Documentation duties
Update docs when behaviour changes: `docs/ADR-xxx.md` for decisions (auth library, id strategy, caching approach), `docs/RUNBOOK.md` (deploy, rollback, restore, rotate secrets, cron), `docs/CONTENT_CONFLICTS.md`, `README.md` (setup in <15 min), admin user guide for client handover.
