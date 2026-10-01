# BUILD_GUIDE — Chawan Farms Platform (start here)

> Companion docs (all in `/docs`): `PRD.md` · `ARCHITECTURE.md` · `DATABASE.md` · `SECURITY.md` · `DESIGN.md` · `CODING_STANDARDS.md` · `MASTER_PROMPT.md` · client PDF in `/docs/source/`.
> **Rule zero:** the client PDF is the source of truth for content (PRD Appendix A). Never invent prices, facilities, policies or claims.

## How to use this guide

1. Do the phases **in order**. Each phase = Objective + numbered Steps. Each step names the **AI tool**, the **documents to attach**, and a **copy-paste prompt**, followed by the **expected output**. Steps marked "You (no AI)" are manual tasks.
2. **Standing instructions:** before Phase 0 Step 2, give `MASTER_PROMPT.md` to your agent once (or save it as `CLAUDE.md` / `AGENTS.md`). Every prompt below is still self-contained.
3. **AI tool column** is a recommendation: *Google Antigravity* for UI-heavy work, *Claude Code* for security/transaction-critical backend work, *OpenAI Codex (or Claude Code)* for tests, tooling and documentation. Any tool can run any step — but use **one tool per step**, and review the diff before moving on.
4. After every step: review the diff → run `npm run lint && npm run typecheck && npm test && npm run build` yourself → commit (Conventional Commits) → only then continue.
5. **Never** ask the AI to build several steps or phases at once. If the AI invents client data or skips a safeguard, stop it and paste the relevant section of `MASTER_PROMPT.md` again.
6. Versions: prompts say "latest stable"; the AI must read the installed version's docs. Pin versions after install.

## Phase map

| Phase | Title | Client decisions needed first |
|---|---|---|
| 0 | Pre-flight: decisions, accounts, analysis | — |
| 1 | Repository & project scaffold | — |
| 2 | Design system & UI prototype (client sign-off) | D-14 (photos) |
| 3 | Database: Neon + Prisma | — |
| 4 | Authentication | D-12 |
| 5 | Authorization & admin shell | D-17 |
| 6 | Cloudinary & media library | D-9 |
| 7 | CMS | D-6, D-7 |
| 8 | Lead management & enquiry forms | D-11, D-13 |
| 9 | Public website | D-6, D-14, D-19 |
| 10 | Booking, pricing & availability | D-1…D-5, D-16, D-18 |
| 11 | Rewards engine | D-8, D-10 |
| 12 | Video submission & moderation | D-9 |
| 13 | Customer dashboard | — |
| 14 | Notifications & scheduled jobs | D-11 |
| 15 | SEO | D-13 |
| 16 | Analytics, consent & monitoring | D-13 |
| 17 | Testing | — |
| 18 | Security audit | — |
| 19 | Performance optimisation | — |
| 20 | Deployment | D-13, D-15 |
| 21 | Production QA & UAT | — |
| 22 | Client handover | — |

(Decision IDs refer to PRD.md §9.)

---

## PHASE 0 – Pre-flight: Decisions, Accounts & Repository Analysis

**Objective:** Lock the scope, collect client decisions, create the accounts you need, and have the AI audit the docs and PDF for gaps before any code exists.

### Step 1 — Create the project folder and accounts (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. Create an empty folder `chawan-farms` and run `git init`. Create a private GitHub repo and push.
  2. Inside it create `/docs` and `/docs/source`. Copy the 8 documents into `/docs` and the client PDF (`CHAWAN_FARM_PRESENTATION_01_10_2026.pdf`) into `/docs/source`.
  3. Create accounts (ideally owned by the client from day one): Vercel, Neon, Cloudinary, Resend, Upstash, Cloudflare (Turnstile), Sentry, Google Analytics.
  4. Send PRD.md §9 (decisions D-1 … D-19) to the client. Resolve at least D-1…D-5 and D-16/D-18 before Phase 10, D-8/D-9 before Phase 11, D-6/D-14 before Phase 9.

* Expected Output: Repo with `/docs` populated, accounts created, decision list sent to client.


### Step 2 — Repository & documentation analysis (no code)

* AI Tool: Claude Code
* Documents to Attach: All 8 `.md` files + client PDF
* Prompt:

```
Act as a senior software architect and product manager. I am about to build the Chawan Farms agri-tourism platform. This step is ANALYSIS ONLY — write no application code.

1. Read every attached document completely: BUILD_GUIDE.md, PRD.md, ARCHITECTURE.md, DATABASE.md, SECURITY.md, DESIGN.md, CODING_STANDARDS.md, MASTER_PROMPT.md and the client PDF.
2. Verify PRD.md Appendix A against the PDF slide by slide. List every mismatch, typo or doubtful extraction (e.g. Marathi text, prices, group sizes, timings).
3. Identify contradictions or gaps between the documents (for example schema vs PRD, security vs architecture) and between the PDF and the old website https://www.chawanfarms.com/.
4. Create `docs/CONTENT_CONFLICTS.md` (start from PRD Appendix B), `docs/OPEN_QUESTIONS.md` (decisions D-1..D-19 plus any new ones, each with the phase it blocks) and `docs/BACKLOG.md` (phase -> tasks -> blockers).
5. Do not create any application code, config or dependencies in this step.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Three new docs in /docs listing conflicts, open questions and a phase backlog; no code changes.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 1 – Repository & Project Scaffold

**Objective:** Turn the empty folder into a working Next.js app matching ARCHITECTURE.md, with Tailwind, quality tooling, CI and a deployed hello-world preview.

### Step 1 — Scaffold Next.js, Tailwind and base structure

* AI Tool: Google Antigravity
* Documents to Attach: `ARCHITECTURE.md`, `CODING_STANDARDS.md`, `DESIGN.md`
* Prompt:

```
Act as a senior Next.js engineer. Using the attached ARCHITECTURE.md, CODING_STANDARDS.md and DESIGN.md, scaffold the project in this workspace.

1. Initialise with `create-next-app` (latest stable Next.js): TypeScript, Tailwind CSS, App Router, ESLint, WITH a `src/` directory, import alias `@/*`. Use npm.
2. Install dependencies: zod, react-hook-form, @hookform/resolvers, clsx, tailwind-merge, class-variance-authority, lucide-react, server-only, motion (Framer Motion). Do NOT install Prisma, auth or Cloudinary packages yet.
3. Enable TypeScript strict options (`strict`, `noUncheckedIndexedAccess`) and fix any resulting errors.
4. Create the folder structure from ARCHITECTURE.md section 4 (`src/app`, `src/components/{ui,marketing,booking,gallery,rewards,admin,account,forms,seo,motion}`, `src/server/{auth,authz,services,repositories,integrations,jobs,policies}`, `src/lib`, `src/config`, `tests/{unit,integration,e2e}`) with `.gitkeep` files where empty.
5. Create route placeholders (each page just returns `<div>PageName placeholder</div>`) for every public, auth, account and admin route in PRD.md section 4, plus `src/app/api/health/route.ts` returning `{ ok: true }`. Use route groups `(public)` and `(auth)`; `account/` and `admin/` as top-level segments.
6. Create `src/config/env.ts` that validates environment variables with Zod and fails fast (only NEXT_PUBLIC_SITE_URL and APP_ENV for now) and a `.env.example` with placeholder values (never real secrets).
7. Configure Tailwind theme tokens from DESIGN.md section 3 as CSS variables in `src/styles/tokens.css` (forest, leaf, paddy, laterite, turmeric, cream, clay, ink, mist, night) and expose them as named Tailwind colours. Add a comment that hex values are starting values pending client approval.
8. Add security headers in `next.config.ts` (X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors/X-Frame-Options, HSTS) and a report-only CSP placeholder.
9. Write NO business logic, no real components and no working pages in this step — scaffolding only.
10. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
11. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
12. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
13. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
14. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: A building Next.js project with the full folder/route skeleton, tokens, env validation, `/api/health` and `.env.example`.


### Step 2 — Quality tooling, tests and CI

* AI Tool: OpenAI Codex (or Claude Code)
* Documents to Attach: `CODING_STANDARDS.md`, `SECURITY.md` (section 15)
* Prompt:

```
Act as a senior engineer focused on developer experience and CI. Using the attached CODING_STANDARDS.md and SECURITY.md, add quality tooling to the existing project.

1. Add Prettier (with tailwind plugin), ESLint rules from CODING_STANDARDS.md section 10 (including jsx-a11y and a `no-restricted-imports` rule preventing client code from importing `@/server/*`).
2. Add Husky + lint-staged + commitlint (Conventional Commits).
3. Add Vitest + Testing Library + jsdom, and Playwright; write one passing smoke test for each (a unit test for a `formatINR(paise)` helper in `src/lib/money.ts` that formats integers in en-IN as `₹1,400`, and an e2e test that `/api/health` returns 200).
4. Add npm scripts: `lint`, `typecheck`, `test`, `test:e2e`, `format`, `build`.
5. Create `.github/workflows/ci.yml` running install, lint, typecheck, test and build on pull requests, plus `CODEOWNERS` marking `src/server/authz`, `src/server/services`, `prisma/` and `src/app/api` as requiring review.
6. Create `README.md` explaining setup in under 15 minutes.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Pre-commit hooks working, CI workflow, passing sample tests, README.


### Step 3 — Connect Vercel and deploy a preview (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. Push the branch to GitHub; import the repo in Vercel.
  2. Add env vars `NEXT_PUBLIC_SITE_URL` and `APP_ENV=preview`.
  3. Open the preview URL and visit `/api/health` — it must return `{ "ok": true }`.
  4. Confirm GitHub Actions CI is green.

* Expected Output: Live preview URL with health check OK and green CI.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 2 – Design System & UI Prototype (client sign-off gate)

**Objective:** Implement the visual identity from DESIGN.md as reusable components and a static clickable prototype so the client can approve the look before data is wired in.

### Step 1 — Tokens, typography and UI primitives

* AI Tool: Google Antigravity
* Documents to Attach: `DESIGN.md`, `CODING_STANDARDS.md`
* Prompt:

```
Act as a senior UI/UX designer and Next.js engineer. Using the attached DESIGN.md and CODING_STANDARDS.md, build the design foundation.

1. Load fonts with `next/font`: a display serif (Fraunces or Playfair Display), Inter for UI text, and Noto Serif/Sans Devanagari or Mukta for Marathi/Hindi. Subset and use `display: swap`.
2. Initialise shadcn/ui and build primitives (Button, Input, Textarea, Select, Checkbox, Dialog, Sheet, Accordion, Tabs, Badge, Card, Toast via sonner) styled with the tokens in `src/styles/tokens.css`. Button variants: primary (turmeric), secondary (forest), ghost, link. All focus states visible; touch targets >= 44px.
3. Add motion wrappers in `src/components/motion/` (`Reveal`, `ParallaxImage`) using IntersectionObserver/CSS transforms only and disabling everything under `prefers-reduced-motion`. Lazy-load the motion library.
4. Create a dev-only `/design` route (noindex, 404 in production) showing every primitive, colour token and type scale.
5. Use placeholder images only (no copyrighted imagery) and no invented copy.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Design tokens, fonts, primitives and a `/design` showcase page.


### Step 2 — Marketing blocks and static prototype pages

* AI Tool: Google Antigravity
* Documents to Attach: `DESIGN.md`, `PRD.md` (sections 4 and Appendix A)
* Prompt:

```
Act as a senior front-end engineer with strong visual design skills. Using DESIGN.md and PRD.md, build the marketing components and a static prototype.

1. Build components in `src/components/marketing/`: Header (with sticky Book/Enquire button), Footer, StickyCtaBar (Call / WhatsApp / Enquire; mobile only; safe-area aware; hidden when a form field is focused), Hero (poster + lazy looped video slot, reduced-motion fallback), SectionHeading, ExperienceCard, PackageCard (veg/non-veg toggle, inclusions list, conditions note), AccommodationShowcase, ActivityTile (with 'subject to conditions & availability' badge), FoodSection, GalleryGrid with accessible Lightbox, RewardsTeaser (3-step graphic, no numbers), LocationBlock, FinalCta.
2. Compose static prototype pages (hard-coded sample data in a `src/lib/prototype-data.ts` file clearly marked PROTOTYPE) for Home (full funnel order: Hero → Why Chawan Farms → Experiences → Accommodation → Packages → Food → Activities → Gallery → Stories → Rewards → Location → CTA), Packages, and a Booking stepper UI shell. Prices and facts must come only from PRD.md Appendix A.
3. Make everything mobile-first (test at 360px), WCAG 2.2 AA (labels, focus, contrast), and avoid layout shift (reserve image space).
4. Run Lighthouse mentally via best practices: no render-blocking scripts, `next/image` with sizes.
5. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
6. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
7. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
8. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
9. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Clickable static prototype of Home, Packages and the booking stepper for client review.


### Step 3 — Client review and sign-off (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. Run the preview on a real phone and a laptop; share the URL with the client.
  2. Collect feedback (colours, imagery, wording) and have the AI apply changes (repeat Step 2 with a smaller prompt).
  3. Record approval in `docs/DESIGN_SIGNOFF.md` (date, who approved).
  4. Ask the client for original photos/videos (PDF images are low-resolution) — decision D-14.

* Expected Output: Signed-off visual direction recorded in the repo.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 3 – Database: Neon + Prisma

**Objective:** Create the production-ready PostgreSQL schema with constraints and triggers (especially the immutable points ledger), plus idempotent seed data from the client PDF.

### Step 1 — Create Neon database (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. In Neon create a project; keep the default `main` branch for production and create a `dev` branch.
  2. Copy the **pooled** connection string (host contains `-pooler`) as `DATABASE_URL` and the **direct** connection string as `DIRECT_URL` into `.env.local` (never commit).
  3. Add the same two vars to Vercel for Preview/Development (use the dev branch strings; Production later).

* Expected Output: `.env.local` with DATABASE_URL and DIRECT_URL for the dev branch.


### Step 2 — Decision records for auth library and ID strategy

* AI Tool: Claude Code
* Documents to Attach: `ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`
* Prompt:

```
Act as a senior security-minded software architect. This step produces two short decision records only.

1. Read the installed documentation (via the web or package docs) of Better Auth and Auth.js (NextAuth v5) as of today, including their Prisma support, email/password, email verification, password reset, database sessions, 2FA, and Next.js App Router compatibility.
2. Write `docs/ADR-001-auth.md` comparing both against SECURITY.md section 2 and recommend one (default recommendation: Better Auth unless current docs show a blocker). Include the exact Prisma tables it requires.
3. Write `docs/ADR-002-ids.md` recommending cuid vs uuid for primary keys with reasons.
4. Do not install packages or change code. Ask me to confirm both decisions.
5. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
6. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
7. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
8. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
9. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Two ADR files; you confirm them before continuing.


### Step 3 — Prisma schema, migrations and constraints

* AI Tool: Claude Code
* Documents to Attach: `DATABASE.md`, `SECURITY.md` (sections 9–10), `ARCHITECTURE.md` (sections 6–8), `docs/ADR-001-auth.md`, `docs/ADR-002-ids.md`
* Prompt:

```
Act as a senior PostgreSQL and Prisma expert. Using the attached DATABASE.md and the confirmed ADRs, implement the database layer.

1. Install prisma and @prisma/client (and the Neon/driver adapter if the installed Prisma version requires it; read its current docs first). Add `tsx` as a dev dependency. Run `prisma init` and configure datasource with `DATABASE_URL` (pooled, runtime) and `DIRECT_URL` (migrations).
2. Implement the FULL schema from DATABASE.md section 3 without simplifying models, adapting only the auth tables to what the confirmed auth library requires (keep our extra columns). Use the confirmed id strategy.
3. Run `prisma validate` and `prisma migrate dev --name init`.
4. Create a second migration with `--create-only` named `integrity_constraints` containing raw SQL for: partial unique index `one_earn_per_video` on PointsLedger, partial unique index `one_active_reward_rule`, the CHECK constraints listed in DATABASE.md comments (ledger sign rules, reason required for ADJUST/REVERSE, booking dates/amounts, availability counters, review rating, balance non-negative), and the `forbid_mutation()` trigger function with BEFORE UPDATE OR DELETE triggers on PointsLedger and AuditLog. Apply it.
5. Create `src/server/db.ts` (Prisma singleton safe for Next.js hot reload, `import 'server-only'`) and a soft-delete helper that excludes rows with `deletedAt`.
6. Write integration tests (Vitest, real Postgres from env `TEST_DATABASE_URL`) proving: UPDATE and DELETE on PointsLedger and AuditLog fail; a second EARN row for the same videoSubmissionId fails; duplicate idempotencyKey fails; duplicate AvailabilityDay(accommodationId,date) fails.
7. Never use `prisma db push` and never run migrations against any production database.
8. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
9. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
10. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
11. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
12. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: A migrated schema with triggers/constraints and passing integrity tests.


### Step 4 — Seed data from the client PDF

* AI Tool: Claude Code
* Documents to Attach: `PRD.md` (Appendix A and B), `DATABASE.md` (section 4–5), client PDF
* Prompt:

```
Act as a careful data engineer. Using PRD.md Appendix A and the client PDF, create an idempotent Prisma seed.

1. Create `prisma/seed.ts` using upserts (safe to run repeatedly) and add `npm run db:seed`.
2. Seed permissions and roles exactly as DATABASE.md section 5.
3. Seed Settings: business name, address (Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra, India) and the three phone numbers from the PDF. Do NOT invent an email address or WhatsApp number — leave them null.
4. Seed accommodation types (Tent, Dormitory, Guest House with note '2 self-contained AC rooms with terrace', Camp Lawn), packages A, B, C and One-Day Picnic with PackageRate rows in paise (A: veg 140000, non-veg 180000; B: veg 230000, non-veg 280000; C: veg 120000, non-veg 180000; Picnic: adult 110000, child 75000), child 4–10 = 60% rule and under-4 free as rate rows, menu items and breakfast list, activities (night campfire, mountain trek, white water river rafting, jungle trail, slide show on biodiversity/wildlife documentaries, star gazing, fishing, bullock cart marked extra cost + prior notice), and amenities list — all copied from the PDF text only. Tag each row's meta with `source: 'client-pdf'`.
5. Seed extras (mutton/chicken per kg, fish, barbecue) with `extraPricePaise` NULL because the PDF gives no amounts.
6. Seed policies as PolicyVersion v1 with the PDF rules, clearly marked in meta as `pendingDecision: 'D-2 cancellation conflict'`.
7. Seed an INACTIVE RewardRule v1 with zeros/nulls and no tiers — do not invent reward values.
8. Do not seed jungle safari, Jain food or any item that is not in the PDF.
9. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
10. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
11. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
12. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
13. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: `npm run db:seed` fills the database with PDF-sourced data; running it twice creates no duplicates.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 4 – Authentication

**Objective:** Secure customer signup, email verification, login, logout, forgot/reset password and sessions using the library confirmed in ADR-001.

### Step 1 — Create service accounts (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. Resend: create an API key; for now use the sandbox sender or verify your domain later.
  2. Upstash: create a Redis database; copy REST URL and token.
  3. Cloudflare Turnstile: create a widget; copy site key and secret.
  4. Generate `AUTH_SECRET` with `openssl rand -base64 32`.
  5. Put all values in `.env.local` and Vercel (Preview).

* Expected Output: All keys available locally and on Vercel Preview.


### Step 2 — Implement authentication

* AI Tool: Claude Code
* Documents to Attach: `SECURITY.md` (sections 2, 3, 5, 7), `ARCHITECTURE.md` (sections 6–7), `DATABASE.md` (identity/RBAC), `CODING_STANDARDS.md`, `docs/ADR-001-auth.md`
* Prompt:

```
Act as a senior security engineer and Next.js developer. Using the attached documents, implement customer authentication with the library chosen in ADR-001. No custom password hashing, session or token code.

1. Read the installed version's official docs of the chosen auth library first and follow its current App Router + Prisma setup.
2. Install and configure: email+password, email verification required before booking/reward actions, forgot/reset password, database-backed sessions, secure cookie settings, trusted origins from env.
3. Add Upstash rate limiting (`src/server/integrations/ratelimit.ts`) per SECURITY.md section 7 for login, signup and reset, and Cloudflare Turnstile verification (`src/server/integrations/turnstile.ts`). Add the new env vars to `src/config/env.ts` and `.env.example`.
4. Add Resend + React Email integration (`src/server/integrations/email.ts`) with templates for verify email and reset password; fall back to console logging in development.
5. Build pages `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` using the design system, React Hook Form + Zod (`src/lib/schemas/auth.ts`), server actions following the pipeline in ARCHITECTURE.md section 6, with field-level errors and loading states.
6. On signup, create `User` (type CUSTOMER) and `CustomerProfile` with a unique referral code in one transaction/hook.
7. Anti-enumeration: forgot-password and login errors must be generic. `callbackUrl` must only allow relative paths.
8. Create `getSession()` and `requireUser()` helpers (`src/server/auth/`) and make `/account` redirect unauthenticated users.
9. Write tests: Zod schemas; signup→verify→login flow; lockout after repeated failures; reset token single-use; redirect safety.
10. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
11. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
12. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
13. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
14. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Working signup/login/reset with verified emails, rate limits and tests.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 5 – Authorization & Admin Shell

**Objective:** Add role-based permissions, staff invitations, 2FA, audit logging and the admin layout with a live dashboard skeleton.

### Step 1 — Authorization module and audit service

* AI Tool: Claude Code
* Documents to Attach: `SECURITY.md` (sections 3, 13), `ARCHITECTURE.md` (sections 7–8), `DATABASE.md` (RBAC, AuditLog), `CODING_STANDARDS.md`
* Prompt:

```
Act as a senior security engineer. Implement central authorization and audit logging.

1. Create `src/server/authz/` with `can(user, permission, ctx?)`, `requirePermission(permission, ctx?)`, `requireStaff()` and ownership helpers. Permissions load from the DB roles/permissions tables (seeded in Phase 3); Super Admin has all. Support parameterised checks (e.g. `rewards.adjust` with an amount cap).
2. Create `src/server/services/audit.ts` with `audit({actor, action, entityType, entityId, before, after, ip, userAgent, requestId})`, redacting sensitive fields.
3. Create a typed `Result<T>` and error codes in `src/lib/result.ts` per CODING_STANDARDS.md section 1.
4. Add a unit-test matrix: each role vs each permission; self-elevation blocked; last Super Admin cannot be removed or demoted.
5. Add a test that scans `src/server/actions/**` and `src/app/api/**` and fails if an exported action/route lacks a permission or auth call (route/action inventory test).
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Authorization and audit modules with a passing permission matrix test.


### Step 2 — Admin shell, staff management and 2FA

* AI Tool: Google Antigravity
* Documents to Attach: `PRD.md` (section 5.6), `DESIGN.md` (admin UI), `SECURITY.md` (sections 2–3), `DATABASE.md`
* Prompt:

```
Act as a senior full-stack engineer. Build the admin shell using the already-created authz and audit modules.

1. Create `src/app/admin/` layout with permission-filtered left navigation (Dashboard, CMS, Bookings, Enquiries, Leads, Customers, Rewards, Media, SEO, Settings, Security), a mobile-friendly top bar, breadcrumbs, and a 'no access' page.
2. Build reusable admin components in `src/components/admin/`: DataTable (TanStack Table with server-side pagination/sorting/filtering), PageHeader, StatCard, FilterBar, ConfirmDialog, StatusBadge.
3. Build the Dashboard with real aggregate queries (leads today/7d/30d, enquiries and bookings by status, pending videos count, recent audit activity) and graceful empty states.
4. Build Security pages: Staff list, invite staff (token email, invite-only, no public staff signup), assign/remove roles, disable staff (revokes sessions), Roles & Permissions matrix, Audit log viewer with filters, and the user's own Sessions list with revoke.
5. Enforce TOTP two-factor for Super Admin and Owner roles using the auth library's 2FA support; show setup flow with QR code and recovery codes.
6. Every server action calls `requirePermission` and writes an audit log. Layout guards are for UX only.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Working admin area with staff/role management, audit viewer, dashboard skeleton and 2FA.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 6 – Cloudinary & Media Library

**Objective:** Safe image and video uploads plus an admin media library that CMS and customer videos will reuse.

### Step 1 — Configure Cloudinary (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. In Cloudinary create folders `site/` (admin media) and `customers/` (customer videos).
  2. Create a **signed** upload preset `admin_images` (allowed formats jpg/png/webp/avif/mp4/webm, max size per DESIGN limits, folder `site/`).
  3. Create a **signed** preset `customer_videos` (formats mp4/mov/webm, max file size and duration agreed in D-9, delivery type `authenticated`, folder `customers/`, eager transformations for web/mobile).
  4. Disable any unsigned presets. Copy cloud name, API key, API secret to `.env.local`/Vercel.

* Expected Output: Two signed presets and credentials ready.


### Step 2 — Cloudinary integration and media library

* AI Tool: Claude Code
* Documents to Attach: `SECURITY.md` (section 8), `ARCHITECTURE.md` (sections 8.6, 9), `DATABASE.md` (Media), `DESIGN.md` (section 9)
* Prompt:

```
Act as a senior full-stack engineer with security focus. Implement Cloudinary integration and the admin media library.

1. Install `cloudinary` (and `next-cloudinary` only if useful). Add CLOUDINARY_* and preset names to `src/config/env.ts` and `.env.example`. The API secret must never be exposed to the client.
2. Create `src/server/integrations/cloudinary.ts`: server-side signing with purpose-scoped folder, preset and allowed formats, public_id generated server-side, asset verification via the Admin API (exists, resource type, format, bytes, duration, folder), and delete.
3. Create `POST /api/upload-signature` (auth + rate limit 5/hour per user for customers, staff permission `media.write` for admin purposes) and `POST /api/webhooks/cloudinary` (verify `X-Cld-Signature` and timestamp; idempotent; 401 on invalid).
4. Create `src/server/services/media.ts` for Media/MediaUsage CRUD: alt text required for public images, usage tracking, delete blocked while in use.
5. Build the admin Media page (`/admin/media`): grid with search, tag/category filters, kind filter, uploader with progress, detail drawer (alt text per locale, caption, focal point, tags, 'where used'), soft-delete.
6. Build components in `src/components/media/`: `CldImage` (f_auto, q_auto, responsive sizes, blur placeholder), `HeroVideo` (poster-first, lazy, disabled for reduced-motion/Save-Data), `MediaPicker` dialog, `Uploader`.
7. Update the CSP/headers allow-list for `res.cloudinary.com` images/media and the Cloudinary upload API in connect-src.
8. Write tests: signature scoped to folder/purpose; forged webhook rejected; oversize/wrong format rejected server-side; delete-in-use blocked.
9. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
10. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
11. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
12. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
13. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Staff can upload/browse media; signed uploads and webhook verified; reusable media components.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 7 – CMS (Admin-Managed Content)

**Objective:** Let the client manage every piece of website content, rates and settings without a developer.

### Step 1 — CMS foundation, Settings, Packages & Rates

* AI Tool: Claude Code
* Documents to Attach: `PRD.md` (5.1, 5.6, Appendix A/B), `DATABASE.md`, `ARCHITECTURE.md` (section 5), `SECURITY.md` (section 4), `CODING_STANDARDS.md`
* Prompt:

```
Act as a senior full-stack engineer. Build the CMS foundation and the first entities.

1. Create Zod schemas in `src/lib/schemas/cms/` and services in `src/server/services/cms/` following the standard mutation pipeline (rate limit → auth → permission → validate → service → audit → revalidate).
2. Build generic admin scaffolding: list page with DataTable, create/edit form with React Hook Form, publish bar (Draft / Scheduled / Published / Archived), soft-delete + trash + restore, and drag/up-down reordering.
3. Implement Settings (business info, phones, email, address, social links, WhatsApp number and default message, booking settings, notification recipients) in `/admin/settings`.
4. Implement Packages with versioned PackageRate editing (new rate row, old row deactivated, validFrom/validTo, seasonLabel), inclusions, conditions (min group, timing note) and linked accommodation/activities. All amounts entered in rupees in the UI and stored as integer paise.
5. Implement Accommodation (types, capacity fields that may be empty, amenities, images).
6. Add cache tags (e.g. `cms:package:<slug>`) and call `revalidateTag` on every publish/update. Add audit logging for publish, rate and settings changes.
7. Localisable fields use the Json `{en: ..., mr?: ..., hi?: ...}` pattern with `en` required.
8. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
9. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
10. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
11. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
12. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Admin can edit settings, packages, rates and accommodation; public cache invalidates on publish.


### Step 2 — Content entities: activities, experiences, food, FAQs, offers, testimonials, gallery, stories

* AI Tool: Claude Code
* Documents to Attach: `PRD.md`, `DATABASE.md`, `SECURITY.md` (section 4)
* Prompt:

```
Act as a senior full-stack engineer. Extend the CMS with the remaining content entities using the scaffolding from the previous step.

1. Implement admin CRUD, preview and publish for: Activities (extra-cost flag, prior-notice flag, conditions note), Experiences, MenuCategory/MenuItem (veg/non-veg, extra-charge flag with price optional), FAQs (groups), Offers (validity dates, linked packages), Testimonials (requires `consentConfirmed` before publish), Gallery (media with categories and ordering), Posts/Stories (categories, cover image, schedule).
2. Add Tiptap rich text (`src/components/admin/RichTextEditor.tsx`) with a server-side allow-list sanitiser (sanitize-html or DOMPurify) applied on save AND on render through a single `SafeHtml` component. Validate link URLs (https, mailto, tel only).
3. Implement 'where used' checks to prevent deleting items referenced elsewhere.
4. Implement preview via signed preview token (`PREVIEW_SECRET`) so unpublished items are never publicly accessible.
5. Any item that exists only on the old website (jungle safari, Jain food, cottage) must be creatable but defaults to DRAFT.
6. Add tests: permission per action, sanitiser strips scripts/event handlers, unpublished never returned by public readers, scheduled publish.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: All content entities editable with preview/publish and safe rich text.


### Step 3 — Pages & sections, SEO fields, policies

* AI Tool: Claude Code
* Documents to Attach: `PRD.md` (sections 4, 5.6), `DESIGN.md` (section 7), `DATABASE.md` (Page, PageSection, SeoMetadata, PolicyVersion)
* Prompt:

```
Act as a senior full-stack engineer. Finish the CMS with page builder-style sections, SEO fields and policies.

1. Define typed section schemas (Zod) for the Home funnel: hero, why-chawan, experiences-grid, accommodation, packages, food, activities, gallery, stories, rewards-teaser, location, final-cta, plus generic rich-text and image+text sections for About.
2. Build `/admin/cms/pages` with section list, add/remove/reorder, per-section form generated from its schema, visibility toggle, preview and publish.
3. Add an SEO panel (title, description, keywords, canonical, robots, OG image picker, JSON-LD override) saved to SeoMetadata for pages, packages, experiences, activities, accommodation and posts.
4. Add Policies management (PolicyVersion create-new-version; never edit published versions) for stay rules, cancellation, privacy and terms. Seeded PDF rules stay flagged pending decision D-2.
5. Seed the Home page and About page structures with the PDF's wording only (taglines such as 'Come live, experience & rediscover yourself & nature at its best').
6. Write tests for section schema validation and page publish revalidation.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Home/About pages assemble from admin-editable sections; SEO and policy management working.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 8 – Lead Management & Enquiry Forms

**Objective:** Capture, deduplicate, attribute and work leads — the primary conversion goal.

### Step 1 — Lead service, forms and tracking

* AI Tool: Claude Code
* Documents to Attach: `PRD.md` (5.4), `DATABASE.md` (Lead*, Enquiry), `SECURITY.md` (sections 4, 7), `ARCHITECTURE.md` (8.3)
* Prompt:

```
Act as a senior full-stack engineer. Implement lead capture and tracking.

1. Install libphonenumber-js. Create `src/server/services/leads.ts` with `upsertLead()`: normalise phone to E.164 (default +91) and lowercase email, dedupe on phone/email, merge attribution, append LeadEvent, create Enquiry with reference `ENQ-YYYY-NNNNNN`.
2. Create a consent-aware attribution helper (`src/lib/attribution.ts`): first-touch and last-touch UTM params, referrer and landing path stored in a first-party cookie (30 days) only when analytics/marketing consent allows, otherwise only the current page path is used.
3. Build form components in `src/components/forms/`: QuickEnquiryForm, ContactForm, PackageEnquiryForm, ActivityEnquiryForm, CampOrganiserQuoteForm (group size 30–50), SchoolGroupForm. Each uses Zod (`src/lib/schemas/leads.ts`), Cloudflare Turnstile, a honeypot field, a minimum-fill-time check, and consent checkbox for contact.
4. Server actions follow the standard pipeline with limits from SECURITY.md section 7 (5/hour per IP, 3/hour per phone/email). Return typed results with field errors. Send admin alert and lead acknowledgement emails via the email integration.
5. Build `WhatsAppButton` and `CallButton` (numbers from Settings, never hard-coded) that record LeadEvents (`WHATSAPP_CLICK`, `CALL_CLICK`) via a lightweight server action/`navigator.sendBeacon`, then open `wa.me` / `tel:` links.
6. Write tests: dedupe across phone formats, honeypot rejection, rate limits, UTM capture, double-submit idempotency.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Forms and click-tracking create/merge leads with attribution and send emails.


### Step 2 — Admin lead pipeline

* AI Tool: Google Antigravity
* Documents to Attach: `PRD.md` (5.4), `DESIGN.md` (admin UI), `SECURITY.md` (sections 3, 4), `DATABASE.md`
* Prompt:

```
Act as a senior full-stack engineer. Build the admin CRM for leads.

1. Create `/admin/leads` with a DataTable (search by name/phone/email, filters for status, source, assignee, date range, follow-up due; saved filters) and Kanban-style status view for New → Contacted → Qualified → Converted → Closed.
2. Lead detail page: contact info, timeline of LeadEvents and enquiries, internal notes, assign to staff, follow-up date, status change with validated transitions (Closed requires a close reason), link to bookings.
3. Bulk actions (assign, change status) with confirmation and audit logging.
4. CSV export at `GET /api/admin/export/leads` requiring `leads.export`, rate-limited (5/hour), audited, and protected against CSV formula injection (prefix cells starting with = + - @ with an apostrophe).
5. Dashboard widgets: new leads by day, source breakdown, conversion funnel counts.
6. Write tests for permissions (assigned vs unassigned), status transitions and CSV injection safety.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Staff can work leads end-to-end with notes, assignment, follow-ups and safe CSV export.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 9 – Public Website

**Objective:** Build every public page from CMS data following DESIGN.md, optimised for mobile and conversion.

### Step 1 — Data readers and the Home page

* AI Tool: Google Antigravity
* Documents to Attach: `DESIGN.md`, `PRD.md` (sections 4–5.1, Appendix A), `ARCHITECTURE.md` (sections 5, 12), `CODING_STANDARDS.md`
* Prompt:

```
Act as a senior Next.js engineer and conversion-focused designer. Build the public data layer and the Home page.

1. Create cached readers in `src/server/services/public-content.ts` returning only PUBLISHED, non-deleted content with cache tags matching the CMS revalidation tags.
2. Wire Header, Footer and StickyCtaBar to Settings (phones, WhatsApp, address). If a value is missing, hide that element rather than inventing one.
3. Build the Home page as Server Components rendering the CMS sections in this exact funnel: Hero → Why Chawan Farms → Experiences → Accommodation → Packages → Food → Activities → Gallery → Customer Stories → Rewards → Location → Booking/Enquiry CTA. Client JS only for interactive leaves (lightbox, toggles, carousels).
4. Hero: LCP image with `priority`, looped muted video loaded lazily after first paint, disabled on reduced motion / Save-Data.
5. Prices appear only from PackageRate data ('from ₹X per person'); if no rate exists show 'Contact us for rates'. Show child 60% / under-4 free and minimum-group conditions near prices where the data exists.
6. Add Open-in-Maps link and a static map image; do not invent distances or travel times.
7. Run Lighthouse (mobile) and fix issues; target LCP <= 2.5s, CLS <= 0.1.
8. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
9. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
10. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
11. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
12. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: A fast, accessible CMS-driven Home page.


### Step 2 — Catalogue pages: Packages, Accommodation, Experiences, Activities, Food

* AI Tool: Google Antigravity
* Documents to Attach: `DESIGN.md` (section 7), `PRD.md`, `DATABASE.md`
* Prompt:

```
Act as a senior Next.js engineer. Build the catalogue pages using the cached readers.

1. Create list and detail routes: `/packages` (+`[slug]` with veg/non-veg toggle, inclusions, conditions, 'Enquire about this package' form), `/accommodation` (+`[slug]`), `/experiences` (+`[slug]`), `/activities` (+`[slug]`, with 'subject to conditions & availability' and 'extra cost' badges) and `/food` (menu accordion, veg/non-veg filter, extra-charge tags).
2. Use ISR with tag-based revalidation; unknown slugs return `notFound()`.
3. Add favourite (heart) buttons on cards for experiences, activities and packages; unauthenticated users are prompted to sign up.
4. Each detail page has `generateMetadata` using SeoMetadata fallbacks (full SEO in a later phase).
5. Check 360px, 768px and 1280px layouts and keyboard navigation.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: All catalogue pages live from admin data.


### Step 3 — Gallery, Stories, Offers, FAQs, About, Contact, Rewards explainer, legal pages

* AI Tool: Google Antigravity
* Documents to Attach: `DESIGN.md`, `PRD.md`, `DATABASE.md`
* Prompt:

```
Act as a senior Next.js engineer. Build the remaining public pages.

1. `/gallery`: masonry, category chips, accessible lightbox (keyboard, swipe, ESC), video tiles, deep-linkable items.
2. `/stories` (+`[slug]`), `/offers` (active offers only, with validity dates), `/faqs` (accordion), `/about`, `/contact` (contact form, phones/address/map from Settings), `/rewards` (how it works: share video → admin approves → earn points → redeem coupon; show numeric values only if read from the active RewardRule, otherwise no numbers), `/privacy`, `/terms`, `/policies` (stay rules from PolicyVersion; show cancellation text as configured).
3. Create `not-found.tsx` and `error.tsx` with friendly designs and a Contact CTA.
4. Run axe and fix issues; verify no layout shift and no hard-coded business data.
5. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
6. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
7. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
8. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
9. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Complete public site ready for client content review.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 10 – Booking, Pricing & Availability

**Objective:** A guided booking/enquiry request flow where the server computes every price and the team confirms each booking.

### Step 1 — Confirm client decisions (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. Get written answers for D-1 (payment mode), D-2 (cancellation/refund), D-3 (GST), D-4 (minimum group scope), D-5 (inventory/capacity), D-16 (seasonal pricing/rate validity), D-18 (extras pricing).
  2. Record them in `docs/OPEN_QUESTIONS.md`. If any is unanswered, tell the AI which default to assume in writing.

* Expected Output: Decisions recorded.


### Step 2 — Pricing engine and availability service

* AI Tool: Claude Code
* Documents to Attach: `ARCHITECTURE.md` (8.1, 8.2), `DATABASE.md` (sales, availability, section 6), `SECURITY.md` (section 10), `PRD.md` (5.3, Appendix A/B), `docs/OPEN_QUESTIONS.md`
* Prompt:

```
Act as a senior backend engineer who specialises in financial correctness. Implement the pricing engine and availability service.

1. Create pure functions in `src/server/policies/pricing.ts`: `quote(input, rateCard) → {lines, subtotalPaise, discountPaise, taxPaise, totalPaise, snapshot}`. Inputs: dates, adults, children 4–10, infants under 4, package, accommodation, food preference, activities/extras, coupon code. Use integer paise only; child 4–10 = percentOfAdult from rate rows; under-4 free; per-person-per-night; minimum group and timing rules from package data and the confirmed decisions.
2. Write golden unit tests using the PDF rates (e.g. Part A veg ₹1400, non-veg ₹1800; Part B veg ₹2300, non-veg ₹2800 with min group 10; Part C 30–50 persons; picnic ₹1100 adult / ₹750 kid; 4–10 years at 60%; under 4 free).
3. Create `src/server/services/availability.ts`: `checkAvailability`, `placeHold`, `confirmBooking`, `releaseBooking` using `SELECT ... FOR UPDATE` via `$queryRaw` tagged templates inside transactions; holds expire via `holdExpiresAt`; blackout periods respected.
4. Create `src/server/services/booking.ts`: `submitBookingRequest` re-quotes on the server (ignore any client price), creates Lead + Booking + BookingLines + PolicyAcceptance (policy version + IP + timestamp), places a hold, queues emails. Implement the booking status state machine (illegal transitions rejected and audited).
5. Create `src/server/services/payments.ts` for manual payment recording (method, amount, reference, received/cleared dates) and a `PaymentProvider` interface (no gateway implementation).
6. Create `GET /api/availability` and `POST /api/quote` (rate-limited 60/min per IP) returning estimates only.
7. Write integration tests: concurrent confirmations cannot overbook; tampered client price is ignored; invalid status transitions fail; hold expiry releases inventory.
8. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
9. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
10. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
11. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
12. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Tested pricing and availability services with no client-trusted values.


### Step 3 — Booking stepper (public)

* AI Tool: Google Antigravity
* Documents to Attach: `DESIGN.md` (booking stepper), `PRD.md` (5.3), `SECURITY.md` (section 10)
* Prompt:

```
Act as a senior front-end engineer focused on forms and accessibility. Build the public `/book` flow.

1. Create a stepper (max 5 steps on mobile): 1) Dates and guests (adults, children 4–10, under 4), 2) Stay type (tent/dormitory, guest house, picnic only, camp-organiser lawn) and food option (veg/non-veg), 3) Optional activities and extras with 'subject to availability / extra cost' notes, 4) Contact details + coupon code (applied via server validation) + special requests, 5) Review with live estimate, policy summary and mandatory policy checkbox.
2. Use an accessible date picker (react-day-picker) with typed-input fallback; blocked/unavailable dates shown from `/api/availability`.
3. The live estimate calls `/api/quote`; label it 'Estimate — final amount confirmed by our team'. Autosave progress to sessionStorage (no PII beyond what the user typed).
4. Pre-fill from `?package=` and `?activity=` params and, for logged-in customers, from their profile.
5. On submit call the server action; show a confirmation page with the reference number, next steps, WhatsApp-share link and a 'create account' prompt.
6. Add Turnstile, honeypot and rate limiting. Handle loading, error and sold-out states.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Guests can submit priced booking requests on mobile and desktop.


### Step 4 — Admin bookings, calendar and availability

* AI Tool: Google Antigravity
* Documents to Attach: `PRD.md` (5.3, 5.6), `DESIGN.md` (admin UI), `DATABASE.md`, `SECURITY.md`
* Prompt:

```
Act as a senior full-stack engineer. Build admin booking management.

1. `/admin/bookings`: list with filters (status, payment status, check-in range, package), detail page (guest info, price lines and snapshot, policy acceptance, timeline), actions: confirm, reject, cancel (with reason), mark completed/no-show, add internal notes, record offline payment, edit availability impact. All actions permission-gated and audited.
2. Manual booking creation for phone/WhatsApp bookings using the same pricing engine.
3. `/admin/availability`: per-accommodation calendar to set capacity, block dates, add blackout periods and view holds/bookings.
4. `/admin/calendar`: month/week view of arrivals and departures.
5. Emails: booking received (guest + admin), confirmed, cancelled — via the outbox/notify interface (templates finalised in the notifications phase).
6. Write tests for permissions and status/payment transitions.
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Staff can confirm, cancel and track bookings, payments and availability.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 11 – Rewards Engine (Points, Ledger, Coupons)

**Objective:** A configurable, tamper-proof points and coupon engine. No reward values are hard-coded — the client sets them in admin.

### Step 1 — Confirm reward configuration with client (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. Agree D-8 values: points per approved video, max points per customer, max submissions per period, minimum points to redeem, discount tiers (fixed/percentage, max discount, min booking value), coupon validity, point expiry, eligible packages/accommodation, combination rules, manual-adjustment limits.
  2. Keep them for entry in the admin UI — do not give them to the AI to hard-code.

* Expected Output: Reward values documented for later entry.


### Step 2 — Ledger, redemption and coupon services

* AI Tool: Claude Code
* Documents to Attach: `SECURITY.md` (section 9), `DATABASE.md` (rewards, section 6), `ARCHITECTURE.md` (8.4, 8.5), `PRD.md` (5.5)
* Prompt:

```
Act as a senior backend engineer specialising in transactional integrity and anti-fraud. Implement the reward engine services.

1. Create `src/server/services/rewards.ts` with `earnPointsForApprovedVideo` (internal only, called by video approval), `redeemPoints`, `adjustPoints`, `approveAdjustment`, `reverseEntry`, `expirePoints`. Every function runs in a DB transaction with row locks, writes an immutable PointsLedger row with an idempotencyKey (`earn:<submissionId>`, `redeem:<couponId>`, etc.), stores `balanceAfter`, `ruleId`, `actorId`, and updates the cached `CustomerProfile.pointsBalance` in the same transaction.
2. Enforce all caps from the ACTIVE RewardRule at execution time: lifetime max points, max submissions per rolling period, minimum points to redeem, manual adjustment max per action and second-approver threshold. Never read any value from the client.
3. Create `src/server/services/coupons.ts`: issue coupon on redemption (random non-guessable code of 10+ chars, snapshot of tier values, expiry from rule), validate coupon (owner, ACTIVE, not expired, package/accommodation eligibility, minimum booking value, max discount, combination rules, discount never exceeds subtotal) and integrate with the pricing engine; create CouponRedemption on booking confirmation and release per the cancellation decision.
4. Create pure policy helpers in `src/server/policies/rewardCaps.ts` and `couponEligibility.ts` with full unit tests.
5. Implement point expiry (FIFO over EARN lots with `expiresAt`) and nightly reconciliation (`SUM(points)` vs cached balance, alert on drift) as job functions in `src/server/jobs/`.
6. Write tests: concurrent double redeem produces exactly one effect; UPDATE/DELETE on ledger fails; caps enforced; another user's coupon rejected; expired/ineligible/stacked coupons rejected; reversal can happen only once; no hard-coded reward numbers (add a test that greps src for obvious literals in rewards code).
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Verified reward engine with immutable ledger and concurrency-safe redemption.


### Step 3 — Reward admin UI

* AI Tool: Google Antigravity
* Documents to Attach: `PRD.md` (5.5 FR-RW-5/6/7, 5.6), `DESIGN.md` (admin UI), `SECURITY.md` (section 9)
* Prompt:

```
Act as a senior full-stack engineer. Build the reward admin screens.

1. `/admin/rewards/rules`: create a new versioned RewardRule with every configurable field from PRD FR-RW-6, manage RewardTiers (name, points cost, fixed/percentage discount, max discount, min booking value, eligible packages/accommodation), preview 'impact summary', and an 'Activate' action that deactivates the previous version. Never edit an active rule in place.
2. `/admin/rewards/ledger`: searchable ledger with customer, type, points, reason, actor, rule version; read-only; export (permissioned and audited).
3. Manual adjustment dialog (permission `rewards.adjust`): customer, points ±, mandatory reason, shows caps; above threshold creates a pending adjustment needing a different staff member with `rewards.adjust.approve`.
4. `/admin/rewards/coupons`: list, filter, revoke (with reason, audited), redemption history.
5. Dashboard widgets: points issued vs redeemed, active coupons, redemption rate.
6. All actions use requirePermission and audit().
7. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
8. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
9. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
10. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
11. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Admins configure reward rules and manage ledger/coupons from the UI.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 12 – Customer Video Submission & Moderation

**Objective:** Customers upload experience videos; points are awarded ONLY when an admin approves.

### Step 1 — Customer upload flow and submission service

* AI Tool: Claude Code
* Documents to Attach: `PRD.md` (5.5), `SECURITY.md` (sections 8, 9, 14), `ARCHITECTURE.md` (8.4, 8.6), `DATABASE.md` (VideoSubmission, Media)
* Prompt:

```
Act as a senior full-stack engineer with security focus. Implement customer video submission.

1. Create `src/server/services/videoSubmissions.ts`: `startUpload` (checks verified email, pending cap, per-period cap from the active RewardRule, daily limit), `completeUpload` (server verifies the Cloudinary asset against the signed folder, format, bytes, duration; creates Media + VideoSubmission with status PENDING; stores contentHash and flags possible duplicates against existing hashes), `withdrawSubmission`.
2. Build `/account/videos/new` with `VideoUploader` (src/components/rewards/): visit date, title/description, MANDATORY ownership/permission checkbox with guidance about other guests and children, SEPARATE optional checkbox allowing Chawan Farms to publish the video on the website/social, accepted formats/size from config, progress bar, retry/resume, accessible status messages.
3. Uploading must NEVER create ledger entries or change any balance. Add a test proving this.
4. Rate-limit and validate everything on the server; do not trust client-reported size/duration/type.
5. Unapproved videos use authenticated/private delivery; never expose them publicly.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Customers can upload; submissions land as PENDING with consent captured.


### Step 2 — Admin moderation queue and approval

* AI Tool: Claude Code
* Documents to Attach: `PRD.md` (5.5, 5.6), `SECURITY.md` (section 9), `DATABASE.md` (section 6), `ARCHITECTURE.md` (8.4)
* Prompt:

```
Act as a senior full-stack engineer. Implement the video review workflow.

1. Build `/admin/rewards/videos`: queue filtered by status with oldest-first ordering, SLA indicator, player using short-lived signed URLs, side panels for duplicate warnings (same hash/near-duplicate), customer history, and 'visit verification' (matching bookings around the claimed visit date).
2. Implement `approveVideo(submissionId)` in ONE transaction: lock the submission row, require status PENDING, reviewer must differ from the submitter, load the active RewardRule, enforce caps, call the rewards service to insert the EARN ledger row with idempotencyKey `earn:<submissionId>`, update balance and set APPROVED with `pointsAwarded` and `rewardRuleId`, write audit, enqueue notification. Double clicks or races must yield exactly one EARN.
3. Implement `rejectVideo` (mandatory reason, no points), `removeVideo` (takedown: delete from Cloudinary, status REMOVED, optional reversal through `reverseEntry` with reason), and optional 'feature on website' only when the customer gave publish consent.
4. Require permission `rewards.videos.review`; audit every decision.
5. Write tests: approve twice → one EARN; reject → no points; reviewer cannot approve own submission; unauthorised preview blocked; cap reached → approval blocked with clear message; end-to-end Playwright: upload → PENDING → approve → points → redeem → coupon → apply on booking quote.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: End-to-end video → approval → points → coupon loop with proven safeguards.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 13 – Customer Dashboard

**Objective:** A self-service account area for bookings, points, coupons, videos, favourites and privacy.

### Step 1 — Account area

* AI Tool: Google Antigravity
* Documents to Attach: `PRD.md` (5.2), `DESIGN.md` (section 6), `SECURITY.md` (sections 3, 14), `DATABASE.md`
* Prompt:

```
Act as a senior full-stack engineer. Build `/account`.

1. Layout with navigation (Overview, Bookings & Enquiries, Rewards, Coupons, My Videos, Favourites, Notifications, Profile, Privacy) and mobile bottom navigation.
2. Overview: points ring, active coupons count, pending videos, next stay, quick actions (Upload video, Book again).
3. Bookings & Enquiries: list and detail with status chips and price snapshot — every query scoped by `userId` from the session; return 404 for others' IDs.
4. Rewards: points balance and ledger timeline (read-only). Coupons: tickets with code copy, expiry, eligibility text and 'Apply on next booking'. Redeem points to coupon via the rewards service (no client-supplied values).
5. My Videos: submissions with status, rejection reason, withdraw action.
6. Favourites list; Notifications centre (mark read); Profile (name, phone, city, marketing consent with ConsentRecord); Privacy: export my data (JSON), request account deletion (creates a request for admin approval), referral code if the feature flag is enabled.
7. Write IDOR tests for every detail route and action; include empty/loading/error states and mobile layouts.
8. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
9. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
10. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
11. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
12. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: A complete, secure customer dashboard.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 14 – Notifications & Scheduled Jobs

**Objective:** Reliable emails and in-app notifications plus cron jobs for expiry, reminders and reconciliation.

### Step 1 — Notification system and jobs

* AI Tool: Claude Code
* Documents to Attach: `ARCHITECTURE.md` (8.7, section 11), `SECURITY.md` (sections 13–14), `DATABASE.md` (Notification, NotificationOutbox)
* Prompt:

```
Act as a senior backend engineer. Implement notifications and cron jobs.

1. Create `notify(event, recipients, data)` writing in-app Notification rows and NotificationOutbox rows; a processor sends via Resend with retries/backoff; emails are sent only AFTER database commit, never inside a transaction.
2. Create React Email templates for: verify email, reset password, lead alert (admin), enquiry acknowledgement, booking received/confirmed/cancelled, video received/approved/rejected, points earned, coupon issued/expiring, pre-arrival reminder (stay rules and 'bring original photo ID' from policy data). Subjects/bodies are admin-editable via Settings with safe variables (escaped).
3. Create Vercel cron route handlers under `src/app/api/cron/` protected by `CRON_SECRET`: expire-points, expire-coupons, outbox-send (every 5 min), lead-reminders, pre-arrival-reminder, reconcile-balances, purge-retention, media-orphans. All idempotent and logged. Add `vercel.json` schedules.
4. Add admin notification settings (recipients, toggles) and respect marketing consent for non-transactional emails.
5. Write tests: retry on failure, cron without secret returns 401, running a job twice has no extra effect, template variables are escaped.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Working notifications and scheduled jobs.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 15 – SEO

**Objective:** Technical and local SEO foundations.

### Step 1 — Metadata, sitemap, structured data, redirects

* AI Tool: Google Antigravity
* Documents to Attach: `PRD.md` (section 6), `DESIGN.md`, `DATABASE.md` (SeoMetadata), `ARCHITECTURE.md` (section 5)
* Prompt:

```
Act as a senior technical SEO engineer and Next.js developer. Implement SEO.

1. Create `src/lib/seo.ts` and implement `generateMetadata` for every public route using SeoMetadata with sensible fallbacks (title template, description, canonical, Open Graph/Twitter with OG image, robots).
2. Create `src/app/sitemap.ts` (published content only, respecting admin exclusions) and `src/app/robots.ts`. All non-production environments must be `noindex`.
3. Create `JsonLd` component and add truthful structured data: LocalBusiness/TouristAttraction for the farm (name, address, phone from Settings), LodgingBusiness where appropriate, FAQPage, Article, Offer. Never output ratings, prices or amenities that are not in the database.
4. Crawl https://www.chawanfarms.com/ to list old URLs and create redirects in `next.config` (document in `docs/REDIRECTS.md`).
5. Add breadcrumbs, internal links, image alt audit script (fails if public images lack alt text).
6. Write `docs/LOCAL_SEO_CHECKLIST.md` (Google Business Profile, NAP consistency, Search Console, review requests, keyword themes such as agri-tourism near Mumbai/Pune, Kolad, Raigad — without promising rankings).
7. Validate with Rich Results Test and Lighthouse SEO; report results.
8. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
9. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
10. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
11. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
12. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Indexable pages with valid metadata, sitemap and schema.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 16 – Analytics, Consent & Monitoring

**Objective:** Measure the funnel without violating consent; monitor errors and performance.

### Step 1 — Consent banner, GA4, events, Sentry

* AI Tool: Claude Code
* Documents to Attach: `PRD.md` (section 6), `SECURITY.md` (section 14), `ARCHITECTURE.md` (section 2, 12)
* Prompt:

```
Act as a senior full-stack engineer with privacy expertise. Implement analytics and monitoring.

1. Build a consent banner (necessary / analytics / marketing) storing choices in a cookie and `ConsentRecord` for logged-in users; nothing non-essential loads before consent.
2. Add GA4 with consent mode via `next/script` (afterInteractive, only after consent); create `src/lib/analytics.ts` with a typed `track()` helper and events: `click_whatsapp`, `click_call`, `generate_lead`, `begin_booking`, `submit_booking`, `signup`, `video_upload_start`, `video_upload_complete`, `coupon_redeem`. Never send phone/email/names.
3. Mirror key conversion events into first-party LeadEvents for the admin dashboard funnel widget.
4. Integrate Sentry (client + server) with PII scrubbing in `beforeSend`, source maps and release tagging; add Vercel Speed Insights.
5. Write tests: no analytics scripts before consent; events fire after consent; PII scrubbed.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Consent-aware analytics, funnel widgets and error monitoring.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 17 – Testing

**Objective:** Close coverage gaps on risky logic and critical user journeys.

### Step 1 — Test audit and gap filling

* AI Tool: OpenAI Codex (or Claude Code)
* Documents to Attach: `CODING_STANDARDS.md` (section 14–15), `SECURITY.md` (section 12)
* Prompt:

```
Act as a senior QA automation engineer. Complete the automated test suite.

1. List existing tests against the required matrix in CODING_STANDARDS.md section 14 and write the gap list to `docs/TEST_GAPS.md`.
2. Add missing unit tests (pricing, policies, money/date helpers, schemas, state machines, coupon eligibility), integration tests with real Postgres (booking confirm races, reward approve/redeem races, ledger immutability, authz matrix, IDOR for every customer route), and component tests with jest-axe.
3. Add Playwright e2e journeys on mobile and desktop: signup→verify→login; enquiry submit; booking request; admin confirms booking; video upload→admin approve→points→redeem→coupon→applied on a booking quote; admin CMS publish → public page updates.
4. Update CI: ephemeral Postgres service, coverage gate (policies/services >= 90% branches, overall >= 70%), run e2e on preview.
5. Fix flaky tests; document how to run everything in README.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Green, deterministic suite with coverage gates in CI.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 18 – Security Audit

**Objective:** Verify every control in SECURITY.md and fix findings before launch.

### Step 1 — Security review and fixes

* AI Tool: Claude Code
* Documents to Attach: `SECURITY.md`, `ARCHITECTURE.md`, `CODING_STANDARDS.md`
* Prompt:

```
Act as an application security engineer. Perform a security audit of this codebase and fix High/Critical issues.

1. Generate a route/server-action inventory (`docs/ROUTE_INVENTORY.md`) and verify authentication, authorisation, Zod validation and rate limiting for each.
2. Walk SECURITY.md section 16 checklist item by item; mark pass/fail with evidence.
3. Verify headers and CSP (move CSP from report-only to enforced when clean), cookie flags, origin checks for mutating routes, open redirects, CSV injection, user enumeration.
4. Review Cloudinary presets, signature endpoint, webhook verification; attempt forged signatures, oversize and wrong-type uploads.
5. Attempt abuse cases in code/tests: IDOR on bookings/videos/coupons/ledger, double approve/redeem races, coupon reuse/stacking, tampered prices and points, privilege escalation, last-super-admin removal.
6. Run `npm audit`, a secret scan (gitleaks) and a SAST tool (CodeQL or semgrep) and triage results; check logs for PII.
7. Write `docs/SECURITY_REPORT.md` with severity-ranked findings, fixes made and risks needing my decision. Fix all High/Critical issues in small commits.
8. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
9. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
10. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
11. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
12. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Security report with all High/Critical issues fixed and re-tested.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 19 – Performance Optimisation

**Objective:** Meet mobile Core Web Vitals and bundle budgets.

### Step 1 — Measure and optimise

* AI Tool: Google Antigravity
* Documents to Attach: `DESIGN.md` (sections 8–11), `ARCHITECTURE.md` (sections 5, 12)
* Prompt:

```
Act as a senior web performance engineer. Measure and optimise performance.

1. Establish baselines with Lighthouse CI (mobile), bundle analyzer and `EXPLAIN` on the slowest DB queries; record in `docs/PERFORMANCE.md`.
2. Optimise LCP (hero image/video strategy, preload, priority), reduce client JS (move work to Server Components, dynamic imports for lightbox, motion, charts), subset fonts, defer third-party scripts until consent/idle, tune Cloudinary transformations and `sizes`.
3. Review caching/ISR tags, add missing DB indexes, remove N+1 queries.
4. Ensure no regressions to accessibility or reduced-motion behaviour.
5. Re-measure and record before/after; targets: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1, initial JS ~<= 150KB gz on marketing routes, Lighthouse mobile >= 90 on Home, Packages, Contact.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Documented before/after metrics meeting the budget.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 20 – Deployment

**Objective:** Production environment on Vercel + Neon + Cloudinary with backups and a rollback plan.

### Step 1 — Prepare production (AI-assisted documentation and config)

* AI Tool: Claude Code
* Documents to Attach: `ARCHITECTURE.md` (sections 10–14), `SECURITY.md` (section 11), `BUILD_GUIDE.md`
* Prompt:

```
Act as a senior DevOps/platform engineer. Prepare the project for production deployment. Do NOT run anything against production; output commands for me to run where credentials are needed.

1. Create `docs/RUNBOOK.md` covering: environments, release process, `prisma migrate deploy` step, rollback (Vercel instant rollback, forward-fix migrations, Neon point-in-time restore), secret rotation, cron monitoring, on-call contacts, incident and breach response.
2. Create `docs/DEPLOYMENT_CHECKLIST.md`: Neon production branch and least-privilege roles, Vercel env vars separated for Production/Preview, Cloudinary production presets, Resend domain SPF/DKIM/DMARC, domain/DNS and old-domain redirects, Sentry release, staging noindex, cron enabled.
3. Add `vercel.json`/config needed for crons, headers and redirects; add a production seed script path that only loads reference data (permissions, roles, catalogue) with no dev fixtures.
4. Write a script `scripts/create-super-admin.ts` that securely creates the first Super Admin from CLI prompts (no secrets in code or env), forcing 2FA enrolment on first login.
5. Document backup and restore: Neon PITR, monthly `pg_dump` to client-owned storage, Cloudinary asset manifest export, and a quarterly restore drill.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Runbook, checklist and scripts ready; nothing touched in production.


### Step 2 — Go live (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. In Neon use the production branch; run `npx prisma migrate deploy` with the production `DIRECT_URL`; run the production seed.
  2. Set Production env vars in Vercel; connect the domain; set DNS; verify HTTPS.
  3. Create the Super Admin with the script; enable 2FA; remove any bootstrap credentials.
  4. Verify Resend domain, Sentry, GA, Turnstile production keys, Cloudinary production presets.
  5. Smoke test: home, enquiry, signup, booking request, admin login, cron endpoints (with secret).
  6. Rehearse a rollback and a database restore once.

* Expected Output: Live production site with working integrations and verified rollback.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 21 – Production QA & UAT

**Objective:** Real-world acceptance testing before announcing the site.

### Step 1 — Generate the UAT pack

* AI Tool: OpenAI Codex (or Claude Code)
* Documents to Attach: `PRD.md`, `SECURITY.md` (section 16), `DESIGN.md`
* Prompt:

```
Act as a senior QA lead. Create the production QA and UAT pack.

1. Create `docs/UAT.md` with pass/fail checklists covering every public page, every form, signup/login/reset, booking request, admin confirmation, payment recording, video upload/approval, points/coupons, notifications, SEO basics, analytics events and admin CMS publish.
2. Create a device/browser/network matrix (low-end Android Chrome, iPhone Safari, desktop Chrome/Edge/Firefox, 3G/4G throttling).
3. Create a content proof-read list comparing every public fact (prices, timings, policies, contact numbers) with PRD.md Appendix A and the client PDF; flag anything not traceable to the PDF.
4. Create an email deliverability test list (Gmail, Outlook, spam score) and an uptime/alert verification list.
5. Add a launch go/no-go summary template with sign-off lines for developer, client and owner.
6. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
7. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
8. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
9. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
10. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: UAT pack ready for execution.


### Step 2 — Run UAT with the client (manual)

* AI Tool: You (no AI)
* Documents to Attach: —
* What you do (no AI):

  1. Execute the checklists on real devices; log defects in the repo issues.
  2. Have client staff perform: publish a page, change a rate, approve a video, update a lead, confirm a booking.
  3. Fix P0/P1 defects (small prompts to the AI), retest, then obtain signed UAT approval.

* Expected Output: Signed UAT and a go/no-go decision.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## PHASE 22 – Client Handover

**Objective:** The client operates the platform independently.

### Step 1 — Handover documentation

* AI Tool: OpenAI Codex (or Claude Code)
* Documents to Attach: `PRD.md` (5.6), `SECURITY.md`, `docs/RUNBOOK.md`
* Prompt:

```
Act as a technical writer and solutions engineer. Produce the client handover documentation. No code changes except fixing bugs you discover in the docs process (report them first).

1. Write `docs/ADMIN_GUIDE.md`: step-by-step instructions with placeholder screenshot markers for every admin module (dashboard, CMS, bookings, enquiries, leads, availability, customers, rewards, media, SEO, settings, security).
2. Write SOPs: `docs/SOP_VIDEO_MODERATION.md` (what to approve/reject, minors, consent, duplicates, takedowns), `docs/SOP_LEADS.md` (response times, statuses, follow-ups), `docs/SOP_BOOKINGS.md` (confirm, cancel, payment recording per the final policy).
3. Write `docs/HANDOVER_CHECKLIST.md`: transfer ownership of Vercel, Neon, Cloudinary, Resend, Upstash, Cloudflare, Sentry, GA, domain; credential storage guidance; monthly maintenance tasks (dependency updates, backup verification, audit log review, ledger reconciliation).
4. Write `docs/TRAINING_AGENDA.md` (2-hour session) and `docs/ROADMAP.md` (payments gateway, Marathi/Hindi, referrals, reviews, loyalty ideas) with effort notes.
5. Before writing code, inspect the existing repository (structure, package.json, prisma/, git log, /docs) and briefly explain your plan and the files you will touch. If something is ambiguous or needs a client decision, ask instead of guessing.
6. Implement ONLY what is described in this step. Do not start later phases. Never invent client information (prices, facilities, policies, contacts) — the client PDF and PRD.md Appendix A are the source of truth.
7. Follow SECURITY.md and CODING_STANDARDS.md: validate all input with Zod, authorise on the server, never trust client-side prices/points/roles.
8. Run `npm run lint`, `npm run typecheck`, `npm test` (where tests exist) and `npm run build` yourself and fix every error you introduced until they pass.
9. Do not delete any existing file in this workspace, including the /docs folder.

Show me a summary of every file you created or changed, any env/DB changes, and step-by-step instructions to verify the result. Then STOP and wait for my confirmation before doing anything else.
```

* Expected Output: Complete handover pack; client performs key tasks unaided in training.


**Phase checkpoint (you):** review the diff, run lint/typecheck/tests/build, test the feature manually on a phone, commit, and update `docs/BACKLOG.md` before starting the next phase.

---

## Appendix — Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Prisma "too many connections" | Direct URL used at runtime | Runtime → pooled `DATABASE_URL`; migrations → `DIRECT_URL` |
| Migration hangs on Neon | Pooled URL used for `migrate` | Use the direct URL |
| Cloudinary upload 401 / blocked | Wrong signature params or CSP `connect-src` | Re-sign on server; allow Cloudinary hosts in CSP |
| Public page not updating after publish | Missing `revalidateTag` | Call tag revalidation in the publish action |
| Balance differs from ledger | Cache not updated in same transaction | Update inside the locked transaction; run reconciliation job |
| Login works locally, fails on preview | `AUTH_URL`/trusted origins mismatch | Configure per environment |
| Date shows one day off | Timezone conversion on stay dates | Use `@db.Date` and `YYYY-MM-DD` strings (Asia/Kolkata display) |
| Emails land in spam | Missing SPF/DKIM/DMARC | Verify domain in Resend |
| Hydration mismatch | Dates/random values in client render | Format on server; stable IDs |
| AI wrote hard-coded prices/reward values | Prompt drift | Stop; paste MASTER_PROMPT §2 and ask it to move values to DB/CMS |
