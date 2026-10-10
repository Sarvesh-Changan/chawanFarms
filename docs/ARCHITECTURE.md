# ARCHITECTURE — Chawan Farms Platform

> Read `PRD.md` first. Versions: use the **latest stable** of each dependency at project start, pin exact versions in `package.json`, and read the installed version's official docs before coding (Next.js, Prisma and auth libraries change APIs between majors — never code from memory).

## 1. Principles
1. **Modular monolith** on Next.js (App Router). One deployable, clear internal module boundaries. No microservices.
2. **Server is the source of truth** for prices, points, roles, availability, coupons.
3. **Server Components by default**; Client Components only for interactivity.
4. **Content & rules in the database**, edited via admin. Nothing business-specific hardcoded.
5. **Thin routes, fat services**: routes/actions validate + authorise, then call domain services; services own transactions.
6. **Security and auditability by construction** (central authz, central audit helper, central rate limiter).
7. **Mobile-first, performance-budgeted.**
8. **Boring technology**: managed services, few dependencies.

## 2. Stack & decisions (ADR summary)

| Concern | Choice | Notes / alternatives |
|---|---|---|
| Framework | Next.js (App Router), React, TypeScript strict | Node runtime for DB/auth routes; Edge only where trivial |
| Styling | Tailwind CSS + shadcn/ui (Radix) primitives | Design tokens in CSS variables (see `DESIGN.md`) |
| DB | PostgreSQL on **Neon** | Pooled URL for runtime, direct URL for migrations; branch per preview |
| ORM | **Prisma** | Follow installed version's setup (driver adapter / `prisma.config.ts` where required). Raw SQL migrations for triggers & partial indexes |
| Auth | **Better Auth** (recommended) — email+password, email verification, reset, DB sessions, optional 2FA/Google; **alternative Auth.js** | ADR-001: pick one in Phase 5 after reading current docs; never hand-roll password/session logic. Use Argon2id/scrypt as library supports |
| Authorization | Custom RBAC (roles→permissions) enforced in a single `authz` module | Customers ≠ staff; staff permissions from DB |
| Media | **Cloudinary** | Signed uploads, upload presets per purpose, eager transformations, webhook verification |
| Email | **Resend** + React Email | Alternative: Postmark/SES |
| Validation | **Zod** (shared client/server schemas) | |
| Forms | React Hook Form + Zod resolver | Progressive enhancement via server actions |
| Rate limiting | **Upstash Redis** + `@upstash/ratelimit` | Fallback DB-based limiter for low-risk routes |
| Bot protection | Cloudflare Turnstile + honeypot | |
| Jobs | **Vercel Cron** → protected route handlers (idempotent) | Upgrade path: Inngest/QStash if workflows grow |
| Analytics | GA4 (consent-gated) + first-party `LeadEvent` | Optional Plausible/PostHog |
| Monitoring | Sentry (errors, perf), uptime monitor, Vercel Analytics/Speed Insights | |
| Tests | Vitest, Testing Library, Playwright, MSW | |
| Animation | `motion` (Framer Motion) sparingly + CSS scroll-driven/IntersectionObserver | Lenis smooth-scroll optional, off for reduced-motion |
| Tables/Admin UI | TanStack Table, shadcn/ui, Recharts or lightweight charts | |
| Rich text | Tiptap (stored as sanitised JSON/HTML) | Sanitise on write **and** render |
| Payments (future) | `PaymentProvider` interface; Razorpay adapter later | Not built in v1 |

## 3. High-level diagram

```
Browser (public / customer / admin)
   │  HTTPS (Vercel Edge Network, CDN, WAF/BotID optional)
   ▼
Next.js App (Vercel)
 ├─ Server Components (SSR/ISR)       ──► services/* ──► Prisma ──► Neon Postgres
 ├─ Server Actions / Route Handlers   ──► authz + zod + ratelimit + audit
 ├─ Webhooks: /api/webhooks/cloudinary, (future) /api/webhooks/payments
 ├─ Cron: /api/cron/* (secret-protected)
 └─ Integrations: Cloudinary • Resend • Upstash • Turnstile • Sentry • GA4
```

## 4. Repository structure

```
/
├─ docs/                      # the 8 md files + CONTENT_CONFLICTS.md, ADRs, runbooks
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/             # includes hand-written SQL (triggers, partial indexes)
│  └─ seed.ts                 # PDF-sourced seed (tagged by source), dev fixtures
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ (public)/            # marketing site, ISR
│  │  ├─ (auth)/              # login, signup, forgot/reset
│  │  ├─ account/             # customer dashboard (auth required)
│  │  ├─ admin/               # admin app (staff + permission required)
│  │  ├─ api/                 # webhooks, cron, upload-signature, health
│  │  ├─ sitemap.ts · robots.ts · manifest.ts · not-found.tsx · error.tsx
│  ├─ components/
│  │  ├─ ui/                  # primitives (shadcn)
│  │  ├─ marketing/ · booking/ · gallery/ · rewards/ · admin/ · account/
│  │  ├─ forms/ · seo/ · motion/
│  ├─ server/
│  │  ├─ db.ts                # Prisma singleton
│  │  ├─ auth/                # auth config, session helpers (getSession, requireUser)
│  │  ├─ authz/               # permissions, can(), requirePermission(), ownership guards
│  │  ├─ services/            # booking, pricing, availability, rewards, coupons, leads, media, cms, notifications, audit
│  │  ├─ repositories/        # optional query helpers per aggregate
│  │  ├─ integrations/        # cloudinary, email, turnstile, ratelimit, analytics
│  │  ├─ jobs/                # cron handlers' logic
│  │  └─ policies/            # business rule functions (pure, unit-tested)
│  ├─ lib/                    # pure utils: money, dates (IST), slug, format, zod schemas (shared)
│  ├─ config/                 # env.ts (zod-validated), constants, feature flags
│  ├─ styles/ · types/ · hooks/
├─ tests/ (unit, integration, e2e)
├─ .github/workflows/ci.yml
└─ .env.example
```

## 5. Rendering & caching strategy

| Route group | Strategy |
|---|---|
| Public marketing/CMS pages | Static/ISR with **tag-based revalidation**: admin publish → `revalidateTag('cms:page:<slug>')`. Cache Components / `use cache` or fetch caching per the installed Next.js version's docs |
| Packages/accommodation (rates) | ISR + tag revalidate on rate change; booking estimate is always computed live server-side |
| Availability | Dynamic, short-cache API; never cached long |
| Account, Admin | Dynamic, `no-store`, auth-gated |
| Gallery | ISR; Cloudinary images via `next/image` loader or `next-cloudinary`, `f_auto,q_auto`, responsive `sizes` |
| Sitemap | Dynamic from published content |

Timezone: store UTC, display/compute dates in **Asia/Kolkata**; stay dates are `DATE` (no time) to avoid TZ bugs.

## 6. Request handling pattern

All mutations (server actions or route handlers) follow:

```
1. Rate limit (by IP + user + action key)
2. Authenticate (session) → 401
3. Authorise (permission and/or ownership) → 403/404
4. Validate input (zod, strict) → 422
5. Bot check (public forms) 
6. Call service inside a DB transaction where multiple writes
7. Write audit log (for privileged/admin or money/points actions)
8. Revalidate cache tags
9. Return typed result { ok, data | error:{code,message,fieldErrors} } — never leak internals
```

Server actions for first-party form mutations; route handlers for webhooks, cron, signature endpoints, exports and anything called by external systems. Every server action is a public endpoint — treat it as such.

## 7. Authentication & authorization

- Sessions: secure, httpOnly, SameSite=Lax cookies; DB-backed sessions allow revocation; rotate on login/privilege change; idle + absolute timeouts (shorter for admin).
- Two principal types: `CUSTOMER`, `STAFF`. Admin routes require `STAFF` **and** specific permission (e.g. `leads.read`). Authorization is enforced in (a) layout-level guard for UX, (b) **every service/action** for security. Middleware/proxy checks are an optimisation only, never the sole control.
- Permission keys: `resource.action` (see `DATABASE.md` seed). Super Admin = all. `can(user, 'rewards.adjust', {amount})` supports parameterised limits.
- Ownership guards for customer data: `where: { id, userId: session.user.id }` always; never accept a userId from the client.

## 8. Core domain services

### 8.1 Pricing engine (`services/pricing`)
Pure function + persisted snapshot: `quote(input, rateCardVersion) → { lines[], subtotalPaise, discountPaise, taxPaise?, totalPaise, rateSnapshot }`. Inputs: dates, party composition (adult, child 4–10, under-4), package/accommodation, food, extras, coupon code. Rules (60% child rate, free under 4, minimum group, per-person-per-night) come from `PackageRate`/`PricingRule` rows, not code constants. All amounts are integers in paise. Unit-tested with golden cases from PDF Appendix A.

### 8.2 Availability (`services/availability`)
`AvailabilityDay(accommodationId, date, capacity, held, booked, blocked)`. Booking requests place a soft **hold** (configurable, e.g. until admin acts); confirmation converts hold to booked inside a transaction with row locking (`SELECT … FOR UPDATE` via `$queryRaw`) to prevent overbooking. Group/minimum-size rules evaluated in `policies/`.

### 8.3 Lead service
`upsertLead({phone,email,source,...})` normalises phone to E.164 (+91 default), dedupes, appends `LeadEvent`, links `Enquiry`/`Booking`, triggers notifications. Attribution captured in a first-party cookie (`cf_attr`, 30-day, consent-aware) and attached server-side.

### 8.4 Rewards (`services/rewards`)
- `submitVideo` (validates Cloudinary asset ownership/metadata, rate limits, hashes, creates `PENDING`).
- `approveVideo(adminId, submissionId)` — **single transaction**: lock submission row → verify `PENDING` → load active `RewardRule` → check caps (period count, lifetime max) → insert ledger `EARN` with `idempotencyKey = "earn:"+submissionId` → update cached balance → set `APPROVED` → audit → notify. Unique DB constraints make a double-click or race harmless.
- `rejectVideo(reason)`; `redeemPoints(userId, tierId)` → lock profile row, verify balance ≥ cost and rule eligibility, insert `REDEEM` entry + create `Coupon` atomically.
- `adjustPoints`, `reverseEntry`, `expirePoints` (cron) all append new ledger rows; **no UPDATE/DELETE on ledger** (DB trigger).
- Balance = `SUM(points)` over ledger; `CustomerProfile.pointsBalance` is a cache updated in the same transaction and verified nightly (reconciliation job alerts on drift).

### 8.5 Coupons
Created from redemption; single-use; bound to the owner; `eligiblePackages/Accommodation` enforced in the pricing engine; combination rules from active `RewardRule`; redemption row `CouponRedemption(couponId unique, bookingId)` created when a booking is **confirmed** (and released on cancellation per policy).

### 8.6 Media (`services/media`)
Upload flow: client requests **signed params** from `/api/upload-signature` (auth + rate limit + purpose: `customer_video` | `admin_media`) → direct browser upload to Cloudinary into a purpose-specific folder & preset (size/format limits, `resource_type`, moderation add-on optional) → Cloudinary webhook (signature verified) and/or server confirmation call records `Media` row with `publicId`, bytes, duration, format, hash. Customer videos are `private`/`authenticated` delivery until approved; public gallery uses only admin-published assets.

### 8.7 Notifications
`notify(event, recipients, data)` writes `Notification` (in-app) and sends email through a queue-like outbox table (`NotificationOutbox`: pending/sent/failed, retries) processed inline then by cron. Templates are admin-editable subject/body fragments with safe variables.

### 8.8 Audit
`audit({actorId, action, entityType, entityId, before, after, ip, ua})` — called from services for all admin writes, role changes, reward/coupon actions, exports, logins to admin, failed permission checks. Append-only (DB trigger), PII-minimised.

## 9. API surface (route handlers)

| Route | Purpose | Auth |
|---|---|---|
| `POST /api/upload-signature` | Cloudinary signed params | customer/staff + limits |
| `POST /api/webhooks/cloudinary` | Upload/moderation notifications | signature |
| `GET /api/availability?from&to&accommodationId` | Public availability summary | public, rate-limited |
| `POST /api/quote` | Price estimate (server-computed) | public, rate-limited |
| `GET /api/admin/export/leads` | CSV export | `leads.export`, rate-limited and audited |
| `GET /api/cron/*` | expire points/coupons, reminders, reconcile, outbox | `CRON_SECRET` bearer |
| `GET /api/health` | Uptime | public minimal |

Everything else is server actions + server-rendered pages.

## 10. Environment variables (`.env.example` — never commit real values)

```
# App
NEXT_PUBLIC_SITE_URL=
APP_ENV=development|preview|production
# Database (Neon)
DATABASE_URL=            # pooled
DIRECT_URL=              # direct, for migrations
# Auth
AUTH_SECRET=             # >=32 random bytes
AUTH_URL=
GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET=   # optional (D-12)
# Cloudinary
CLOUDINARY_CLOUD_NAME= CLOUDINARY_API_KEY= CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_UPLOAD_PRESET_ADMIN= CLOUDINARY_UPLOAD_PRESET_VIDEO=
# Email
RESEND_API_KEY= EMAIL_FROM= ADMIN_NOTIFY_EMAIL=
# Anti-abuse
NEXT_PUBLIC_TURNSTILE_SITE_KEY= TURNSTILE_SECRET_KEY=
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN=
# Jobs
CRON_SECRET=
# Observability
SENTRY_DSN= SENTRY_AUTH_TOKEN= NEXT_PUBLIC_GA_ID=
```
`src/config/env.ts` validates with Zod at boot and **fails fast**. Only `NEXT_PUBLIC_*` may reach the client. Secrets differ per environment (dev/preview/prod). Business phone/WhatsApp/email live in the **Settings table**, not env.

## 11. Background jobs (Vercel Cron)

| Job | Frequency | Action |
|---|---|---|
| `expire-points` | daily | Write `EXPIRE` entries for lapsed lots (FIFO) |
| `expire-coupons` | daily | Mark expired |
| `outbox-send` | every 5 min | Retry failed emails |
| `lead-reminders` | hourly/daily | Follow-up due notifications |
| `pre-arrival-reminder` | daily | Email guests with ID/policy checklist (P1) |
| `reconcile-balances` | nightly | Compare cache vs ledger; alert on drift |
| `purge-retention` | weekly | Apply retention policy (SECURITY.md) |
| `media-orphans` | weekly | Report unused Cloudinary assets |

All jobs idempotent, logged, and protected by `CRON_SECRET`.

## 12. Performance architecture
- Route-level JS budget: marketing pages ≤ ~150 KB gz JS initially; admin may be larger.
- Hero video: poster-first, `preload=none`/lazy, short loop (≤ 8 s, ≤ ~2 MB mobile rendition), disabled on Save-Data/reduced-motion/slow connections.
- Images: Cloudinary `f_auto,q_auto,c_fill`, correct `sizes`, blur placeholders, `priority` only for LCP image.
- Fonts: `next/font`, subset incl. Devanagari only where used.
- Third-party scripts: load after interaction/consent; no tag-manager sprawl.
- DB: indexes per `DATABASE.md`, avoid N+1 with `select/include` discipline, pagination everywhere in admin.

## 13. Deployment & environments
- GitHub → Vercel. `main` = production, PRs = preview deployments with **Neon branch** per preview (optional) and seeded dummy data.
- Migrations: `prisma migrate deploy` in build/release step against `DIRECT_URL`; destructive migrations need manual review.
- Environments: local (Neon dev branch or Docker Postgres), preview, production. Separate Cloudinary folders/presets (or cloud) per environment.
- CI (GitHub Actions): install → lint → typecheck → unit/integration (against ephemeral Postgres) → build → Playwright smoke on preview.
- Rollback: Vercel instant rollback; DB rollback = forward-fix migration or Neon point-in-time restore (runbook in `docs/RUNBOOK.md`).

## 14. Backup & recovery
- Neon PITR (confirm retention window of the chosen plan) + scheduled logical dump (`pg_dump`) to client-owned storage monthly.
- Cloudinary: enable backup/ keep originals; export asset manifest (publicIds + metadata) monthly from DB.
- Secrets in Vercel project settings + password manager; recovery procedure documented; quarterly restore drill.

## 15. Scalability notes
Expected traffic is modest; bottlenecks are media bandwidth (CDN-solved) and write hot spots (availability/ledger, solved with row locks and short transactions). If needed later: read replicas on Neon, queue for emails, move cron to a workflow engine, extract media processing.

## 16. Extension points
`PaymentProvider`, `NotificationChannel` (email/in-app now; WhatsApp/SMS later), `StorageProvider` abstraction around Cloudinary calls, feature flags table (`Setting` keys `feature.*`) for referral, social login, 2FA enforcement, i18n.
