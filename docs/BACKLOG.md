# Chawan Farms Build Backlog

Status: Phase 0 requirements/repository analysis completed on 2026-10-02. No application code, configuration, dependency or database work has started. All later phases remain pending client confirmation and the phase gates in `BUILD_GUIDE.md`.

The backlog follows the prescribed build order. Blockers are deliberately explicit; an unanswered client decision must not be replaced with an invented default.

## Phase 0 — Pre-flight: decisions, accounts and analysis

Tasks:

- [x] Inspect repository structure, `package.json`, lockfiles, `prisma/`, Git history and `/docs`.
- [x] Read BUILD_GUIDE, PRD, ARCHITECTURE, DATABASE, SECURITY, DESIGN, CODING_STANDARDS, MASTER_PROMPT and the client PDF.
- [x] Audit all 30 PDF slides against PRD Appendix A.
- [x] Compare available archived old-site material with the PDF and PRD source-of-truth rules.
- [x] Create `CONTENT_CONFLICTS.md`, `OPEN_QUESTIONS.md` and this backlog.
- [ ] Obtain written answers to the blocking client decisions and record them in `OPEN_QUESTIONS.md`.

Blockers:

- The live old website was unreachable from the analysis environment; the old-site comparison uses dated public archive captures and must be reconfirmed against the current client-owned site.
- D-20 and D-21 are needed before corrected PDF copy is treated as approved CMS content.

## Phase 1 — Repository and project scaffold

Tasks:

- Scaffold the Next.js App Router/TypeScript project and the prescribed folder structure.
- Add quality tooling, scripts, tests, CI and placeholder environment validation.
- Create only safe route placeholders and health check; no business data or production secrets.

Blockers:

- Phase 0 analysis checkpoint and repository-owner approval.
- Must preserve the three analysis documents and all existing `/docs` files.

## Phase 2 — Design system and UI prototype

Tasks:

- Implement tokens, typography, accessible primitives, reduced-motion behavior and prototype marketing blocks.
- Build static Home, Packages and booking-stepper prototypes from approved PDF facts only.
- Obtain client visual sign-off and record it.

Blockers:

- D-14/D-32: original media, image rights, people/minor consent.
- D-7: launch languages and translation scope.
- D-20/D-21: approved copy/transcription.

## Phase 3 — Database: Neon and Prisma

Tasks:

- Confirm auth-library and ID ADRs.
- Implement and migrate the reviewed schema, raw integrity constraints and immutable ledger/audit triggers.
- Add integration tests for ledger immutability, uniqueness, availability and constraint behavior.
- Seed only PDF-sourced reference data with source-slide metadata; leave unknowns null/draft.

Blockers:

- D-30/D-31/D-38/D-39/D-40 require schema decisions for price adjustments, policy state, gallery, revisions and privacy requests.
- D-1/D-2/D-3/D-4/D-5/D-16/D-18 affect booking/rate schema behavior.
- ADR-001 (auth library) and ADR-002 (ID strategy) have not been created/approved.

## Phase 4 — Authentication

Tasks:

- Implement the approved established auth library with email/password, verification, reset, secure sessions and anti-enumeration.
- Add rate limiting/Turnstile integration and auth schemas/tests.
- Resolve account-access behavior for `/account` and booking-linked actions.

Blockers:

- D-12 for social login scope.
- D-28 for anonymous versus verified booking requests.
- Required provider credentials are not available and must not be invented.

## Phase 5 — Authorization and admin shell

Tasks:

- Implement deny-by-default RBAC, permission checks, ownership helpers and append-only audit service.
- Build staff invitation, roles, session revocation, 2FA gate and admin shell.
- Test role/permission matrix and last-Super-Admin protections.

Blockers:

- D-17: staff list, role assignments, video approvers, point-adjustment authority and second approver.
- Auth implementation and seeded permissions from Phase 3/4.

## Phase 6 — Cloudinary and media library

Tasks:

- Configure separate signed admin/customer upload purposes.
- Implement scoped signing, asset verification, signed webhooks, private customer-video delivery and media usage checks.
- Build admin library with alt text, captions, focal point, tags and safe deletion.

Blockers:

- D-9: customer-video format, size, duration and consent rules.
- D-14/D-32: original assets and rights/consent.
- Cloudinary account/preset credentials are not available.

## Phase 7 — CMS and admin-managed content

Tasks:

- Build Settings, Packages/Rates, Accommodation and CMS foundations.
- Add Activities, Experiences, Menus, FAQs, Offers, Testimonials, Gallery, Stories, Pages, Sections, SEO and versioned Policies.
- Preserve source strings/source slides and support draft/publish/preview.
- Seed approved PDF catalogue content and keep old-site-only items draft.

Blockers:

- D-6, D-7, D-14, D-15, D-19, D-20, D-21, D-25, D-26, D-31, D-33, D-38 and D-39.
- D-18 for prices on extras; D-2 for publishing cancellation policy.

## Phase 8 — Lead management and enquiry forms

Tasks:

- Implement lead normalization/dedupe, attribution, events and enquiry creation.
- Build contact, quick enquiry, package/activity, Camp Organiser and school forms.
- Add Turnstile, honeypot, minimum-fill-time, rate limits, consent, acknowledgements and admin alerts.
- Build the admin lead pipeline, notes, assignment, follow-ups and safe CSV export.

Blockers:

- D-11/D-13: notification channels, recipients, email and WhatsApp details.
- D-28 if a booking form is coupled to verified accounts.
- D-37: canonical current contacts versus archived contacts.

## Phase 9 — Public website

Tasks:

- Build CMS-backed Home funnel and catalogue routes.
- Build Gallery, Stories, Offers, FAQs, About, Contact, Rewards explainer and legal/policy pages.
- Wire Settings-based contacts and rates; show no unknown facts as if confirmed.
- Verify mobile accessibility, SEO basics and performance budgets.

Blockers:

- D-6/D-7/D-14/D-15/D-19/D-20/D-21/D-25/D-26/D-33.
- D-13 for phone/WhatsApp/email/map/analytics details.
- D-2 for public cancellation text.

## Phase 10 — Booking, pricing and availability

Tasks:

- Record written answers to payment, cancellation, tax, minimum-group, inventory, seasonal-rate and extras decisions.
- Implement server-only integer-paise quote/pricing engine with immutable snapshots and golden tests.
- Implement availability rows, holds, blackout dates and race-safe confirmation.
- Build public booking stepper and admin booking/calendar/payment management.
- Add policy acceptance version/IP/timestamp and status/payment state machines.

Blockers:

- D-1 through D-5, D-16, D-18, D-22 through D-25, D-28 through D-30 and D-34 through D-36.
- No price, capacity, tax or cancellation assumption is permitted.

## Phase 11 — Rewards engine

Tasks:

- Implement versioned RewardRule, immutable ledger, idempotency, caps, redemption, coupon eligibility, adjustments, reversal and expiry.
- Build concurrency/integrity tests and reward admin configuration/read-only ledger/coupon screens.
- Keep all reward values database-managed and inactive until configured.

Blockers:

- D-8 and D-10.
- D-30/D-40 for audit/privacy interactions where relevant.
- Phase 3 ledger constraints and Phase 5 permission/audit services.

## Phase 12 — Customer video submission and moderation

Tasks:

- Implement verified upload completion, asset re-verification, duplicate flagging, consent capture and private delivery.
- Build customer upload and admin oldest-first moderation queue.
- Approve/reject/remove with one transactional EARN path; no points on upload.
- Add visit verification and publish-consent behavior.

Blockers:

- D-8/D-9/D-17/D-20/D-21/D-25/D-32.
- Phase 6 media signing, Phase 5 authz and Phase 11 rewards.

## Phase 13 — Customer dashboard

Tasks:

- Build account navigation, bookings/enquiries, points/ledger, coupons, videos, favourites, notifications and profile.
- Add export and deletion-request workflow with ownership/IDOR tests.

Blockers:

- D-28 for account/booking relationship.
- D-40 for privacy requests, legal retention and workflow.
- Phases 4, 5, 10, 11 and 12.

## Phase 14 — Notifications and scheduled jobs

Tasks:

- Implement outbox notifications, retry/backoff, templates and post-commit delivery.
- Add protected idempotent jobs for expiry, reminders, reconciliation, retention and media orphans.

Blockers:

- D-11/D-13/D-15.
- Resend/cron/monitoring credentials and final policy copy.

## Phase 15 — SEO

Tasks:

- Implement metadata, sitemap, robots, truthful JSON-LD, breadcrumbs, image-alt audit and redirects.
- Reconcile old URL inventory against the current/archived website.

Blockers:

- D-13/D-20/D-27/D-33.
- Live-site access/current URL confirmation.

## Phase 16 — Analytics, consent and monitoring

Tasks:

- Build consent banner and ConsentRecord behavior.
- Add consent-gated analytics events, Sentry scrubbing and performance monitoring.
- Verify no PII is sent to analytics or logs.

Blockers:

- D-11/D-13/D-15.
- Provider credentials and approved purposes/retention.

## Phase 17 — Testing

Tasks:

- Audit coverage against coding/security matrices.
- Fill unit, integration, component, accessibility and Playwright journey gaps.
- Add CI database/e2e/coverage gates.

Blockers:

- Phases 1–16 must provide code and testable flows.
- All unresolved money, policy, auth, reward and content decisions remain test blockers.

## Phase 18 — Security audit

Tasks:

- Inventory routes/actions and verify authn/authz/Zod/rate limits.
- Test IDOR, tampered prices/points, races, uploads, webhooks, headers, CSV injection and enumeration.
- Run dependency/secret/SAST audits and produce the security report.

Blockers:

- Complete implementation and provider configuration from earlier phases.
- D-8/D-9/D-17/D-28/D-40 for the intended security behavior.

## Phase 19 — Performance optimisation

Tasks:

- Establish Lighthouse/bundle/query baselines.
- Optimize LCP, media, client JS, fonts, caching, indexes and N+1 queries.
- Record before/after metrics and verify accessibility/reduced-motion behavior.

Blockers:

- Public CMS-backed pages and production-like media from Phases 2, 6, 7 and 9.
- D-14/D-32 for final imagery.

## Phase 20 — Deployment

Tasks:

- Create runbook/deployment checklist, environment separation, backup/restore and rollback documentation.
- Configure Vercel/Neon/Cloudinary/Resend/Upstash/Turnstile/Sentry/analytics without touching production automatically.
- Prepare first Super Admin creation and cron protection.

Blockers:

- D-1/D-2/D-3/D-9/D-11/D-13/D-15/D-27/D-33.
- Client-owned production accounts, domain/DNS and legal approvals.

## Phase 21 — Production QA and UAT

Tasks:

- Create the UAT pack, device/network matrix, content proofread list and go/no-go template.
- Run client scenarios: CMS publish, lead handling, booking confirmation/payment, video moderation, points/coupon redemption.

Blockers:

- Production-like environment and all required client decisions.
- D-20/D-21 and every unresolved fact/policy question affecting displayed content.

## Phase 22 — Client handover

Tasks:

- Produce admin guide, video/lead/booking SOPs, handover checklist, training agenda and roadmap.
- Transfer ownership of external accounts and document maintenance/backup/audit routines.

Blockers:

- Completed UAT and client sign-off.
- Final account owners, legal text, operating policies and staff assignments.

## Current safe next step

Obtain written answers to the rows in `OPEN_QUESTIONS.md`, beginning with D-20/D-21 for content, D-1–D-5/D-16/D-18 for booking, and D-8/D-9 for rewards/media. Then review this backlog and explicitly approve the next phase. No code or infrastructure should be started by this analysis step.
