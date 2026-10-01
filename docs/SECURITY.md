# SECURITY — Chawan Farms Platform

> Mandatory reading for every contributor/AI agent. Security rules override convenience, speed and visual polish. If a task conflicts with this file, stop and ask.

## 1. Threat model (summary)

| Asset | Threats |
|---|---|
| Admin accounts | credential stuffing, phishing, session theft, privilege escalation |
| Reward points & coupons (monetary value) | fake uploads, duplicate videos, race conditions (double approve/redeem), client tampering, insider abuse, coupon guessing/sharing |
| Customer PII (name, phone, email, bookings, videos) | IDOR, data leaks via exports/logs, over-collection |
| Customer videos (may include minors/other guests) | unauthorised public exposure, copyright/consent disputes, malicious files |
| Public forms | spam, bot floods, email-header injection, enumeration |
| Media account (Cloudinary) | unsigned/over-permissive uploads, cost-abuse (storage/bandwidth), API secret leak |
| Availability/pricing | client-side price manipulation, hold-flooding (blocking inventory) |
| Supply chain | malicious/compromised npm packages, leaked env vars |

## 2. Authentication
- Use the **chosen established auth library** only (Better Auth or Auth.js). No custom password hashing, session or token code.
- Passwords: strong hashing via library (Argon2id/scrypt/bcrypt with sane cost), min length 10, check against breached-password list where available, no composition-rule theatre, allow password managers/paste.
- Email verification before first booking-linked or reward action; verification and reset tokens: single-use, hashed at rest, short-lived (reset ≤ 30 min, verify ≤ 24 h), invalidated on password change; reset responses are **identical** whether the email exists or not (anti-enumeration).
- Brute force: per-IP **and** per-account rate limits + progressive delay/lockout (e.g. 5 failures → 15 min cool-down) + Turnstile after repeated failures. Alert staff on admin lockouts.
- Sessions: httpOnly, Secure, SameSite=Lax cookies; DB-backed (revocable); rotate on login, password change, role change; idle timeout (customer 30 d sliding, admin 8 h idle / 24 h absolute); "sign out all devices"; password change revokes other sessions.
- Admin: **2FA (TOTP) required** for Super Admin/Owner and recommended for all staff (P1 launch gate); admin login at `/admin` shows no hints about valid accounts; admin accounts are created by invitation only (no public signup path to staff).
- Social login (if enabled): verified-email only; never auto-link accounts by unverified email.

## 3. Authorization
- **Deny by default.** Every server action/route handler calls `requireUser()` / `requirePermission('x.y')` first. Layout/middleware gating is UX only.
- Customer data access always scoped: `where: { id, userId: session.userId }`. Return **404** (not 403) for others' resources to avoid enumeration. Never accept `userId`, `role`, `points`, `price`, `discount`, `status` from the client for authority.
- RBAC permissions seeded in `DATABASE.md`; permissions checked server-side with parameters where relevant (`rewards.adjust` + amount ≤ role cap).
- Separation of duties: the person who adjusts points above threshold cannot be the approver; staff cannot edit their own roles; last Super Admin cannot be removed/demoted.
- Staff offboarding: disable user + revoke sessions in one action; audit-logged.
- IDOR test cases are mandatory in the test suite (§12).

## 4. Input validation, XSS, injection
- Validate **every** input with Zod (`.strict()`), server-side, including server-action arguments, query params, headers used for logic, webhook payloads.
- SQL injection: Prisma parameterised queries only. `$queryRaw` must use tagged template (`Prisma.sql`) — **never** string concatenation or `$queryRawUnsafe`/`$executeRawUnsafe` with user input. Raw SQL limited to locks/constraints and reviewed.
- XSS: React escapes by default. **No** `dangerouslySetInnerHTML` except through a single `<SafeHtml>` component that renders **server-sanitised** rich text (allow-list sanitiser, e.g. `sanitize-html`/DOMPurify with strict config), and sanitise on write and on render. Validate URLs (only `https:`/`mailto:`/`tel:`) in CMS link fields. SVG uploads are not allowed (or must be sanitised).
- Email header injection: strip CR/LF in name/subject fields; never use user input as email headers.
- CSV export: prefix cells beginning with `= + - @` with `'` to prevent formula injection.
- Open redirects: only allow relative `callbackUrl` values or allow-listed hosts.
- SSRF: no server-side fetch of user-supplied URLs.
- Path traversal: no filesystem paths from user input.

## 5. CSRF & request integrity
- Server Actions: rely on Next.js built-in Origin/Host checks; keep `serverActions.allowedOrigins` minimal and explicit.
- Route handlers that mutate state with cookie auth: require same-origin (`Origin`/`Sec-Fetch-Site` check) or CSRF token; `SameSite=Lax` cookies. Webhooks and cron use **signature/bearer** auth, not cookies.
- GET requests never change state.

## 6. Security headers & transport
- HTTPS only, HSTS (preload after verification), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation off by default), `X-Frame-Options: DENY`/`frame-ancestors 'none'` (allow YouTube/Maps embeds via `frame-src` only if used).
- **CSP** via nonce-based policy: `default-src 'self'`; `img-src 'self' data: https://res.cloudinary.com`; `media-src 'self' https://res.cloudinary.com`; `script-src 'self' 'nonce-…'` (+ GA/Turnstile origins as needed); `connect-src` allow-list (Cloudinary upload API, Sentry, GA); `frame-ancestors 'none'`; start in report-only, then enforce.
- Cookies prefixed `__Host-`/`__Secure-` where supported.

## 7. Rate limiting & anti-abuse (Upstash + DB fallback)

| Endpoint/action | Limit (starting values; tune) |
|---|---|
| Login | 5/15 min per account, 20/15 min per IP |
| Signup | 5/hour per IP |
| Forgot password | 3/hour per email, 10/hour per IP |
| Enquiry/contact/booking forms | 5/hour per IP, 3/hour per phone/email, + Turnstile + honeypot + min-fill-time |
| Quote/availability API | 60/min per IP |
| Upload signature | 5/hour per user; 20 videos/lifetime pending cap |
| Coupon apply attempts | 10/hour per user (anti-guessing) |
| Admin actions | generous but logged; export 5/hour |

Return generic `429` with `Retry-After`. Log aggregate abuse metrics; block repeat offenders (temporary IP/phone denylist managed in admin).

## 8. Cloudinary & video upload security
1. **Signed uploads only.** Never expose the API secret; never use unsigned presets for customer content. Signature generated per upload with: folder (`customers/{userId}/videos`), `upload_preset`, `timestamp`, allowed formats, max file size, `resource_type`, public_id generated server-side (not client-chosen).
2. Preset constraints: allowed formats (`mp4,mov,webm` — confirm D-9), max bytes (e.g. 200 MB cap, confirm), max duration, `type=authenticated` (private until approved), eager transformations for web/mobile renditions, optional moderation add-on (e.g. AWS Rekognition) and virus scanning if available.
3. Client-side checks (type/size/duration) are UX only. **Server re-verifies** via Cloudinary Admin API/webhook: asset exists, belongs to the signed folder, resource type/format/bytes/duration within limits, then creates `Media` + `VideoSubmission`.
4. Do not trust MIME/extension; rely on Cloudinary-detected format. Reject archives, executables, SVG, HTML, PDFs for the video flow.
5. Webhook verification: validate `X-Cld-Signature` + timestamp window; idempotent handling.
6. Quotas: per-user pending cap, per-day cap, global monthly bytes alert to avoid cost abuse.
7. Delivery: customer videos not publicly guessable; admin preview via short-lived signed URLs; public gallery uses only admin-published `Media.isPublic=true` assets. If the user withdraws consent or video is removed, delete from Cloudinary and set `REMOVED`.
8. Duplicate detection: SHA-256 of original (if available client-side/hash from Cloudinary `etag`) + perceptual hash on key frames (post-processing step) — flag, don't auto-reject; admin sees "possible duplicate of #…".
9. Admin media uploads: staff-only, image/video allow-list, alt text mandatory for public images.
10. Secrets rotation: Cloudinary API secret rotated on staff change/leak; stored only in Vercel env.

## 9. Reward, points & coupon integrity (the highest-risk logic)

**Invariants (enforced in DB where possible and re-checked in code):**
1. Upload ≠ reward. Only `approveVideo` (permission `rewards.videos.review`) can create an `EARN` row.
2. Exactly one `EARN` per `VideoSubmission` (partial unique index) and unique `idempotencyKey` on every ledger write.
3. Ledger is append-only (trigger rejects UPDATE/DELETE). Corrections are `ADJUST`/`REVERSE` rows with reason, actor, and caps.
4. Points, discounts, eligibility, expiry computed **only on the server** from the active `RewardRule` version; any value from the client is ignored.
5. All balance-changing paths run in a DB transaction with row locks; no check-then-act outside a transaction.
6. Caps from rule: max points per customer, max submissions per period, min points to redeem; evaluated at approval/redemption time.
7. Coupon: random ≥ 10-char code from unambiguous alphabet, bound to owner (`userId`), single-use (`CouponRedemption.couponId` unique, `bookingId` unique), expiry enforced server-side, eligibility (package/accommodation/min booking/max discount/combination) enforced by pricing engine; discount can never exceed subtotal or `maxDiscountPaise`.
8. Self-dealing prevention: staff cannot approve videos from their own customer account or linked bookings; reviewer ≠ submitter.
9. Manual adjustments: permission `rewards.adjust`, per-action cap from rule, reason required, second approver above threshold, every action audit-logged, daily summary emailed to Owner.
10. Account-farming controls: email verification, phone captured on profile, one reward per visit date/booking (configurable), device/IP velocity checks, flag multiple accounts sharing phone, admin "visit verification" (match to booking) shown in review UI.
11. Nightly reconciliation (`SUM(ledger)` vs cached balance) alerts on drift.
12. Anomaly alerts: spike in submissions, repeated rejects, same hash across users, many redemptions in short time.

## 10. Booking & pricing integrity
- Client sends **selections**, never prices. Server recomputes the quote on submit and on confirm, stores `pricingSnapshot`.
- Hold-flooding prevention: holds expire (`holdExpiresAt`), per-IP/phone limits, holds do not block inventory unless admin policy says so.
- Confirmation is a staff action (v1). Status transitions validated by a state machine; illegal transitions rejected and audited.
- Offline payment records: staff-only, immutable once `CLEARED` (corrections via new entries), audited. Never store card numbers, CVV or full bank account numbers.
- Policy acceptance (version + timestamp + IP) captured per booking.

## 11. Secrets & environment
- No secrets in Git, client bundles, logs or error messages. `.env*` in `.gitignore`; `.env.example` has placeholders only. Secret scanning (GitHub push protection / gitleaks) in CI.
- Zod-validated env at boot; separate secrets per environment; least-privilege DB roles (app role cannot DROP/ALTER; migration role separate); Neon IP allow-listing/`sslmode=require`.
- Rotate on exposure or staff change; document owners in `docs/RUNBOOK.md`.
- Dependency hygiene: lockfile committed, `npm audit`/Dependabot/Renovate, review new dependencies (maintenance, downloads, install scripts), pin exact versions, no `postinstall` surprises.

## 12. Security testing requirements
- Unit/integration tests: authz matrix (each permission × role), IDOR (user A cannot read/modify user B's booking, video, coupon, ledger), reward invariants (double approve race, double redeem, ledger mutation blocked, caps), coupon abuse (expired, other user's, ineligible package, stacking), pricing tampering, rate limits, upload signature scope, webhook signature rejection, CSV injection, open redirect, enumeration responses.
- Concurrency tests: parallel `approveVideo` and `redeemPoints` must yield exactly one effect.
- Pre-launch: SAST (CodeQL/semgrep), dependency audit, header/CSP scan, manual OWASP ASVS L2-lite checklist, and (recommended) external penetration test of auth/rewards.

## 13. Logging, audit & monitoring
- **Audit log** (append-only) for: admin login/failed login/2FA, CRUD on CMS publish state, rate/price changes, booking status & payment changes, reward rule changes, video decisions, ledger adjustments/reversals, coupon revocations, role/permission changes, exports, settings changes, data-deletion actions. Fields: actor, action, entity, before/after (redacted), IP, UA, request id, time.
- Application logs: structured, request-id correlated, **no PII/secrets/tokens/passwords**; PII masked (phone `+91******56`).
- Sentry with PII scrubbing (`beforeSend`), alerts for auth anomalies, 5xx spikes, cron failure, webhook failures, ledger drift.
- Uptime monitoring + status page link for staff.

## 14. Privacy & data protection (India DPDP Act 2023 aligned — client to obtain legal review)
- Collect minimum data. Privacy notice at collection points; separate unticked consent for marketing; consent records stored (`ConsentRecord`).
- Analytics/ads cookies only after consent (banner); essential cookies exempt.
- Customer rights: view/edit profile, export data, request deletion (workflow with admin approval within a defined period), withdraw marketing consent, grievance contact shown in Privacy page.
- Video & minors: upload form requires confirmation that the uploader owns the content and has permission of people shown; special guidance for children (parent/guardian consent); **public reuse requires separate explicit consent** (`consentPublish`); easy takedown path; admin can blur/skip faces or reject videos showing identifiable minors without guardian consent.
- Photo-ID: PDF requires showing original photo ID at check-in — **do not collect or store ID images/numbers online** unless the client explicitly decides (D-new) and then encrypt, restrict, and retain minimally.
- Exports (CSV): permission-gated, rate-limited, audited, watermarked with exporter + timestamp in file name; avoid exporting more fields than needed.
- Data retention per `DATABASE.md §8`; scheduled purge job; backups encrypted; processors list (Vercel, Neon, Cloudinary, Resend, Upstash, Sentry, Google) documented in Privacy Policy.
- Breach response runbook: detect → contain → assess → notify (regulator/users as required) → postmortem.

## 15. Secure development workflow
- PRs require review; security-sensitive paths (`server/authz`, `server/services/rewards`, `services/booking`, `prisma/migrations`, `api/webhooks`, upload code) require **CODEOWNERS** review.
- Branch protection, signed commits recommended, CI must pass (lint, typecheck, tests, build, secret scan, audit).
- Feature flags for risky features (referral, social login).
- AI-agent rules: never disable security checks "temporarily"; never weaken validation to make a test pass; never commit secrets; never run destructive DB commands against production; ask before adding dependencies with native/install scripts.

## 16. Pre-launch security checklist
- [ ] All routes/actions have authN/authZ + Zod validation (automated route inventory test)
- [ ] IDOR/authz matrix tests green
- [ ] Reward invariants & concurrency tests green; ledger trigger verified in prod DB
- [ ] Rate limits + Turnstile live on all public forms and auth
- [ ] CSP enforced (no report violations on core flows); headers scan A grade
- [ ] Cloudinary presets locked; unsigned preset disabled; webhook signature verified
- [ ] Admin 2FA enabled for Owner/Super Admin; default accounts removed
- [ ] Secrets rotated for production; none in repo history (gitleaks full scan)
- [ ] Backups + restore drill done; audit log verified; Sentry alerts routed to a real person
- [ ] Privacy policy, terms, consent banner, video consent wording approved by client
- [ ] Dependency audit clean or risk-accepted in writing
