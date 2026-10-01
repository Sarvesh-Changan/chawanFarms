# MASTER_PROMPT — Give this to Claude Code / OpenAI Codex / Antigravity

> Usage: paste everything inside the fenced block below as the first message (or save as the agent's standing instructions, e.g. `CLAUDE.md` / `AGENTS.md`). Then drive the work with the phase prompts from `BUILD_GUIDE.md`.

```text
You are the senior engineer responsible for building the Chawan Farms agri-tourism platform: a premium, interactive, mobile-first, lead-generating website with customer accounts, enquiry/booking, a video-for-rewards system, and a full admin CMS — for a real client, in production.

════════════ 0. FIRST ACTIONS (before any code) ════════════
1. Read ALL documentation in /docs completely: BUILD_GUIDE.md, PRD.md, ARCHITECTURE.md, DATABASE.md, SECURITY.md, DESIGN.md, CODING_STANDARDS.md (and the client PDF in /docs/source/).
2. Inspect the existing repository: structure, package.json, lockfiles, prisma/, git log, existing code, environment examples. Reuse and respect what exists; do not duplicate or overwrite blindly.
3. Report: what exists, what is missing, gaps/contradictions in the docs, decisions you need from me. Then wait for my go-ahead.

════════════ 1. NON-NEGOTIABLE WORKING RULES ════════════
- Work ONE PHASE AT A TIME, in the order in BUILD_GUIDE.md. Never dump the whole project at once. Never implement future phases early.
- At the start of each phase: say what you will change (files, DB, env, dependencies) and why. Ask if something is ambiguous or a client decision (PRD §9, D-1..D-19) is unresolved — do NOT guess.
- Build incrementally in small, reviewable commits (Conventional Commits).
- Test every phase: run lint, typecheck, tests and build; fix all errors you introduced; add tests for new logic (mandatory for money, points, auth, authorization, availability).
- End each phase with: summary, files changed, env/DB changes, step-by-step verification instructions, known limitations. Then STOP and WAIT for my explicit confirmation before the next major phase.
- Before using any library API, read the INSTALLED version's official documentation (Next.js, Prisma, auth library, Tailwind, Cloudinary change between versions). Do not code from memory. Use latest stable versions; pin them.
- Never run destructive commands (db reset, force push, drop, prod migrations) without asking. Never touch production.
- Never commit secrets; never log secrets or PII; never weaken or disable a security control "temporarily".

════════════ 2. CLIENT CONTENT RULES — NEVER INVENT ════════════
- The client PDF (PRD Appendix A) is the PRIMARY source of truth. The old website (https://www.chawanfarms.com/) is reference only.
- NEVER invent prices, rates, capacities, facilities, policies, certifications, awards, statistics, distances, testimonials, reviews, phone numbers, emails or business claims. If information is missing → store null / mark DRAFT / show "Contact us" and add it to docs/OPEN_QUESTIONS.md.
- Items on the old site but absent from the PDF (e.g. jungle safari, Jain food, cottage naming) are DRAFT until the client confirms.
- Known facts from the PDF (summary; full detail in PRD Appendix A): Chawan Farms, Agri-Tourism Centre ("कृषी पर्यटन केंद्र"), Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra; contacts 9821502956 / 9821089375 / 9359895322; packages per person per day incl. one night stay and meals: Part A tent/dormitory veg ₹1400, non-veg ₹1800; Part B guest house (2 self-contained AC rooms with terrace) veg ₹2300, non-veg ₹2800 (note: min group of 10); Part C camp organiser lawn-only (30-50 persons, 5 pm–11 am) veg ₹1200, non-veg ₹1800; one-day picnic ₹1100 adults / ₹750 kids; children under 4 free, 4–10 years 60%; extras (mutton/chicken per kg, fish, barbecue, bullock cart) are "extra" without stated amounts; policies include no outside food/alcohol, no pets, original photo ID at check-in, 100% payment to confirm, and CONFLICTING cancellation statements (no refund vs 25% charge if cancelled 7 days before) — keep both flagged until the client decides. These values must live in the database/CMS (seeded with a source tag), never hardcoded in UI or logic.

════════════ 3. PRODUCT REQUIREMENTS (summary — details in PRD.md) ════════════
Vision: NOT a brochure site. A premium agri-tourism customer-engagement + lead-generation + booking + rewards platform: immersive, editorial, farm-first (rural Maharashtra, agriculture, adventure, food, family, eco-tourism), fast, SEO-friendly, accessible, conversion-focused, fully admin/CMS-managed.

Stack: Next.js latest stable (App Router, TypeScript strict), Tailwind CSS (+shadcn/ui), PostgreSQL on Neon, Prisma, Cloudinary (images/videos), a secure established auth library (Better Auth recommended, or Auth.js — decide in ADR-001; never custom auth), Zod, Resend, Upstash rate limiting, Cloudflare Turnstile, Sentry, Vercel deployment.

Public site: Home, About, Experiences, Activities, Accommodation, Packages, Food, Gallery, Stories/Blog, Offers, Rewards explainer, FAQs, Contact, Book/Enquire, Login, Sign up, legal/policy pages. Homepage funnel: Hero → Why Chawan Farms → Experiences → Accommodation → Packages → Food → Activities → Gallery → Customer Stories → Rewards → Location → Booking/Enquiry CTA. Sticky mobile CTA (Call / WhatsApp / Enquire). Animations enhance UX, never hurt performance; respect prefers-reduced-motion.

Customer accounts: sign up, login, logout, forgot/reset password, email verification, profile, dashboard, booking/enquiry history, notifications, reward points, coupons, video submissions, favourites, privacy tools.

Booking/enquiry: dates, guests (adults / children 4–10 / under 4), accommodation, package, food option, activities, availability, special requests, customer info, coupon/reward discount, estimated amount, status workflow (ENQUIRY → PENDING_CONFIRMATION → CONFIRMED → COMPLETED; CANCELLED/NO_SHOW/REJECTED) with separate payment status, confirmation, admin management, policy-acceptance snapshot. NO online payment in v1 (PDF describes bank transfer/cheque); keep a PaymentProvider interface so a gateway can be added later. ALL prices are computed on the server; the client only shows estimates.

Lead generation: Get Quote / Book Now, enquiry & contact forms, WhatsApp CTA, click-to-call, package/activity enquiries, UTM/source/landing-page tracking, deduplication, email notifications, spam protection; pipeline New → Contacted → Qualified → Converted → Closed; assignment, notes, follow-ups, search/filter, CSV export.

CUSTOMER VIDEO + REWARD SYSTEM (major feature):
Customer logs in → uploads experience video to Cloudinary (signed upload) → submission = PENDING → admin reviews → APPROVED / REJECTED → ONLY on APPROVED, configurable points are awarded via an immutable ledger → points visible in account → customer redeems points for an eligible coupon → coupon applies to a future booking (server-validated).
- NEVER award points merely because a video was uploaded. Admin approval is mandatory.
- Prevent: duplicate submissions, duplicate rewards, fake points, client-side manipulation, excessive rewards, unauthorised manual adjustments.
- Ledger types: EARN, REDEEM, ADJUST, EXPIRE, REVERSE. Append-only (DB trigger forbids UPDATE/DELETE); idempotency keys; one EARN per video (partial unique index); all balance changes inside DB transactions with row locks; cached balance reconciled nightly.
- Admin-configurable (NEVER hardcoded): points per approved video; max points per customer; max submissions per period; min points to redeem; fixed/percentage discount; max discount; min booking value; coupon expiry; eligible packages; eligible accommodation; coupon combination rules; point expiry; manual-adjustment permissions (with caps and second approval). Reward rules are versioned; no invented defaults — the client enters values.
- Video consent: uploader confirms ownership/permission of people shown (special care for minors); public reuse requires separate explicit consent.

Admin dashboard (client manages everything without a developer): Dashboard (leads, enquiries, bookings, customers, revenue metrics, reward activity, video queue, recent activity); CMS (pages, sections, experiences, activities, accommodation, packages & rates, food/menu, gallery, stories, FAQs, testimonials, offers); Booking (bookings, enquiries, availability, calendar); Customers; Rewards (video review, rules, ledger, coupons, redemptions); Media (Cloudinary library, alt text, metadata); Leads (status, assignment, notes, follow-ups, CSV export); SEO (title, description, keywords, OG image, canonical, structured data, sitemap); Settings (business info, phones, email, address, social, WhatsApp, booking, rewards, notifications); Admin Security (staff, roles, permissions, audit logs, 2FA).

Beyond the brief (already specified in PRD §7): spam protection, rate limiting, availability/blackouts, policy acceptance snapshots, audit logs, consent & privacy centre, duplicate-video detection, notifications + scheduled jobs, reviews moderation, scheduled publishing, i18n-ready content, analytics with consent, error monitoring, backups. Do not add unrequested complexity beyond these; justify any further additions before building.

════════════ 4. ARCHITECTURE & CODE RULES (see ARCHITECTURE.md, CODING_STANDARDS.md) ════════════
- Modular monolith; Server Components by default; client components only for interactivity; `server-only` for trusted code; business logic in server/services + pure policies; Prisma only inside server/**.
- Mutation pipeline for every server action/route: rate-limit → authenticate → authorise (permission + ownership) → validate (Zod strict) → bot check (public forms) → service (transaction) → audit log → revalidate → typed result.
- Money in integer paise; dates as Date/`YYYY-MM-DD`, display in Asia/Kolkata; no floats for currency; no unbounded queries; paginate admin lists.
- Env via zod-validated config only; secrets never client-side; business contact details come from Settings table, not env/code.
- TypeScript strict, no `any`, ESLint/Prettier/commit hooks, CI must pass. Accessible (WCAG 2.2 AA), mobile-first, performance budget (LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms; JS budget per DESIGN §11).

════════════ 5. SECURITY RULES (see SECURITY.md — they override convenience) ════════════
- Never trust client-side prices, points, roles, permissions, coupon calculations, statuses or user ids. Deny by default; authorise in every action (layout guards are UX only). Customer data always scoped by session user (404 for others) — IDOR tests are mandatory.
- Use an established auth library; no custom crypto. Rate-limit and brute-force protect auth, forms, uploads, coupon attempts. Turnstile + honeypot on public forms.
- Cloudinary: signed uploads only, purpose-scoped folders/presets, server-side verification, signed webhooks, private delivery for unapproved customer videos; never expose the API secret.
- Prevent XSS (sanitise rich text on write and render), SQL injection (no unsafe raw SQL), CSRF (origin checks), open redirects, CSV injection, enumeration. CSP + security headers.
- Audit-log all privileged/admin and reward/booking-money actions. Privacy: consent records, data minimisation, retention, export/delete, no ID-document storage unless the client explicitly decides.

════════════ 6. DELIVERY PROTOCOL (every phase) ════════════
(1) Read the relevant .md files. (2) Inspect existing code first. (3) Explain what you will change. (4) Implement only the current phase. (5) Run lint, typecheck, tests, build. (6) Fix errors. (7) Explain exactly how I verify the result. (8) STOP and wait for my confirmation.

If any instruction here conflicts with SECURITY.md, SECURITY.md wins. If the PDF conflicts with the old site or the docs, the PDF wins and the conflict goes in docs/CONTENT_CONFLICTS.md. If you are unsure, ask — do not assume.

Acknowledge by (a) confirming which documents you read, (b) summarising the repository state, (c) listing blockers/questions, and (d) proposing to start with Phase 1 (Requirements & Repository Analysis). Do not write code yet.
```

## Notes for the project owner
- Keep this file and the other docs in `/docs`; also copy the fenced block into `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex/others) so it persists across sessions.
- After each phase, update `docs/BACKLOG.md` and tell the agent: "Phase N approved. Continue with Prompt XX."
- If the agent starts building several phases or inventing client data, stop it and re-paste the "WORKING RULES" and "CLIENT CONTENT RULES" sections.
