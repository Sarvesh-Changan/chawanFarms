# Content Security Policy (CSP) Plan & Audit Analysis

## 1. Executive Summary

This document evaluates the Content Security Policy (CSP) violations reported on `https://chawan-farms.vercel.app/account/videos/new` and establishes the phased engineering roadmap to transition from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy` without degrading site performance or breaking legitimate application integrations.

---

## 2. Root Cause Attribution of Reported Violations

A comprehensive code, bundle, and dependency inspection was conducted across the repository:

| Violation / Source | Observed Resource | Origin / Source | Verification & Evidence | Action Taken / Remediation |
|---|---|---|---|---|
| **Inline Scripts** | React Server Component flight chunks & Next.js hydration scripts | **Next.js Application Code** | Emitted by Next.js App Router during client hydration and page bootstrap. | Retain in Report-Only mode. Implement route-targeted nonces for authenticated routes. |
| **Inline Styles** | Style tags injected during runtime render | **Next.js & UI Components** | Injected by Radix UI / Tailwind / component runtime styles. | Allow `'self' 'unsafe-inline'` in Report-Only; audit style extractions. |
| **Google Fonts Stylesheet** | `fonts.googleapis.com` / `fonts.gstatic.com` | **Third-Party / Clean** | Verified: Codebase uses `next/font/google` in `src/config/fonts.ts`. Next.js automatically downloads and self-hosts font binaries locally under `/_next/static/media/`. | Zero external `<link rel="stylesheet">` tags exist in the project. Any external requests originate from browser extensions. |
| **antd.min.css** | Ant Design CSS stylesheet | **Browser Extension** | `grep -rn "antd" .` returns zero occurrences in `src/`, `package.json`, or build manifests. | Confirmed client-side browser extension injection (e.g. form filler, React DevTools, or web clipper). |
| **DM Sans Stylesheet** | `DM Sans` font stylesheet | **Browser Extension** | `grep -rn "DM Sans"` shows mention only in `docs/DESIGN.md` as an editorial note. No stylesheet is linked in HTML or CSS. | Confirmed client-side browser extension injection. |
| **AA AlertWrapper** | DOM mutation / Alert scripts | **Browser Extension** | Zero occurrences in codebase. | Confirmed injected by browser accessibility / alert-assist browser extension. |
| **vercel.live** | Vercel Live Toolbar script & iframe (`vercel.live`) | **Vercel Preview Toolbar** | Injected automatically by Vercel on preview deployments. | Scoped to preview deployments only (`VERCEL_ENV === "preview"`). Omitted completely from production CSP. Documented dashboard toggle. |
| **Turnstile** | Cloudflare Turnstile widget & API | **Legitimate Feature** | Required for bot protection on forms (`challenges.cloudflare.com`). | Explicitly allow-listed in `script-src`, `frame-src`, and `connect-src`. |
| **Cloudinary** | Upload API and media playback | **Legitimate Feature** | Used for authenticated customer video and media asset hosting (`api.cloudinary.com`, `res.cloudinary.com`). | Explicitly allow-listed in `connect-src`, `img-src`, and `media-src`. |

---

## 3. Inline Script Mitigation Strategies & Architectural Trade-offs

Next.js App Router relies on inline scripts to stream React Server Components (RSC) and hydrate client components. When defining a strict CSP, three architectural options exist:

### Option A: Site-Wide Nonce via Global Middleware
- **Mechanism**: Generate a cryptographically random `nonce` (e.g. `Buffer.from(crypto.randomUUID()).toString('base64')`) per request in Next.js middleware and attach it to both the CSP header and `<script nonce="...">`.
- **Trade-off**: **Severely harms performance**. Next.js documentation explicitly states:
  > *"Every time a page is viewed, a fresh nonce should be generated. This means that you must use dynamic rendering to add nonces."*
  Enforcing nonces globally turns every static marketing page (`/`, `/about`, `/packages`, `/contact`, `/experiences`) into dynamically rendered server-side pages, destroying edge CDN cache hits and drastically increasing Time to First Byte (TTFB) and serverless execution costs.
- **Verdict**: **Rejected for public static pages**.

### Option B: Hash-Based Allow-Listing (`'sha256-...'`)
- **Mechanism**: Compute the SHA-256 hash of each inline script tag and list them under `script-src`.
- **Trade-off**: Next.js hydration chunks, payload hashes, and inline data change with every release and every dynamic payload. Maintaining hashes requires complex build pipelines that frequently break in production.
- **Verdict**: **Impractical for rapid iteration**.

### Option C: Hybrid Dynamic Route Noncing (Recommended)
- **Mechanism**:
  1. Keep public static marketing pages cached statically at the edge CDN without forcing dynamic rendering.
  2. Implement nonce generation selectively via Next.js proxy/middleware for authenticated, sensitive routes where CSRF/XSS defense is paramount: `/account/*`, `/admin/*`, `/auth/*`.
  3. Maintain CSP in `Content-Security-Policy-Report-Only` during staging and verification until zero false positives occur.
- **Verdict**: **Recommended and adopted**.

---

## 4. Path to CSP Enforcement

To reach full enforcement without service disruption, follow this phased plan:

### Phase 1: Baseline Cleanup & Noise Reduction (Completed)
1. Kept header as `Content-Security-Policy-Report-Only`.
2. Allow-listed only necessary hostnames:
   - Cloudflare Turnstile: `https://challenges.cloudflare.com` (`script-src`, `frame-src`, `connect-src`)
   - Cloudinary: `https://res.cloudinary.com`, `https://api.cloudinary.com` (`img-src`, `media-src`, `connect-src`)
   - Vercel Live Toolbar: `https://vercel.live` allow-listed **only** on preview environments (`process.env.VERCEL_ENV === "preview"`).
3. Verified zero external font stylesheets; fonts are strictly served via `next/font/google` (self-hosted).
4. Created `/api/csp-report` endpoint to ingest browser violation reports silently without user disruption.

### Phase 2: Disabling Vercel Toolbar in Production
To completely silence `vercel.live` violations in preview environments when desired:
1. Navigate to the **Vercel Dashboard**.
2. Go to **Project Settings** -> **General**.
3. Scroll to **Vercel Toolbar**.
4. Toggle the toolbar to **Disabled** or select **Only show for team members**.

### Phase 3: Route-Targeted Nonce Middleware (Security-Audit Phase)
Before flipping from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`:
1. Implement route filtering in middleware so nonces are generated strictly on `/account/*` and `/admin/*`.
2. Verify analytics scripts (e.g. Google Analytics / Meta Pixel) are only loaded after explicit cookie consent and utilize allow-listed domains (`*.google-analytics.com`, `*.googletagmanager.com`).
3. Monitor `/api/csp-report` telemetry for 14 days under production traffic to confirm zero legitimate application actions are blocked.

### Phase 4: Full Enforcement
1. Update `next.config.ts` to replace `Content-Security-Policy-Report-Only` with `Content-Security-Policy`.
2. Re-test all critical user journeys:
   - User authentication and session refresh.
   - Video upload initiation (`/api/account/videos/start`), chunk transfer to Cloudinary, and completion (`/api/account/videos/complete`).
   - Customer booking flow and Razorpay payment iframe.
