# Superseded by the admin simplification on 2026-10-27. Retained as a historical QA record.

Step 4 note: historical central-library observations below are superseded. Verify uploads and replacement from each owning form; the former media URL redirects to `/admin`.

# Admin → public-site propagation test report


Run date: 27 October 2026 (Asia/Calcutta)
Environment: local DEV configuration, DEV database/Cloudinary, production build on `127.0.0.1:3101`
Scope: testing/reporting only; no application, schema, or config changes were made.

## Executive counts

| Severity | Confirmed bugs | Not verified / environment findings |
|---|---:|---:|
| Critical | 0 | 0 |
| High | 0 | 1 |
| Medium | 2 | 1 |
| Low | 0 | 1 |

These counts cover only evidence obtained in this run. The many authenticated CRUD and Cloudinary Admin API cases remain `Not verified`, not Pass.

## Execution evidence

| Check | Result | Evidence |
|---|---|---|
| `npm run build` | Pass | Next.js 16.3.8 compiled, TypeScript completed, 55 static pages generated, route inventory emitted. |
| `npm start` on port 3000 | Not verified | Port 3000 was already occupied and a fresh server received `EACCES`; the existing process was not stopped. |
| Production server on port 3101 | Pass for health; DB-backed pages only with DEV network access | `/api/health` 200; local sandbox initially produced Prisma `EACCES`, then the approved DEV-connected run served public pages. |
| Anonymous public HTTP smoke | Pass for status | `/`, `/about`, `/accommodation`, `/activities`, `/experiences`, `/food`, `/faqs`, `/gallery`, `/offers`, `/packages`, `/rewards`, `/stories`, `/contact`, `/policies`, `/privacy`, `/terms`, `/book` returned 200; `/location` redirected 308; `/sitemap.xml` returned 200 XML. |
| Desktop public diagnostics | Fail | All tested public routes lacked a canonical link. Four 400 requests came from Cloudflare Turnstile challenge endpoints; no application response failure was observed. |
| Mobile public diagnostics | Fail | `/contact` has document-level horizontal overflow: `main`/container measured 408px against a 390px viewport. |
| Authenticated admin→visitor propagation | Not verified | No `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`, or propagation fixture was supplied; the guarded Playwright test skipped and created no records. |
| Dev-mode repeat | Fail / constrained | The existing DEV server on port 3000 returned 200 for the primary routes and reproduced missing canonical links. A clean dev server was not started because Next reported the port was already occupied. |

## Entity results

| Entity/action | Public locations checked | Result | Visibility delay | Evidence / reason |
|---|---|---|---|---|
| All anonymous public route shells | Primary public routes listed above | Pass for HTTP | Not measured per mutation | Production server returned 200/redirect as recorded above. |
| Home/Page Builder | Home, About, metadata, sections | Not verified | — | No authenticated QA fixture. Source map shows page tags and paths. |
| Package/rate | Package list/detail, Home, quote, booking | Not verified | — | No QA package/rate was created. |
| Accommodation | List/detail, Home, package related block | Not verified | — | No QA accommodation was created. |
| Experience/Activity | Lists, details, Home, package related block | Not verified | — | No QA records were created. |
| Food/Menu | Food and Home | Not verified | — | No QA menu change was made. |
| FAQ | FAQ page and JSON-LD | Not verified | — | No QA FAQ was created. |
| Offer | Offers and validity boundaries | Not verified | — | No QA offer or clock fixture. |
| Testimonial | Home and consent gate | Not verified | — | No QA testimonial was created. |
| Post/Story | Stories list/detail, Home, metadata, sitemap | Not verified | — | No QA story was created. |
| Gallery | Gallery, Home teaser, filters/lightbox | Not verified | — | No QA gallery item was created. |
| Settings | Header/footer/contact/CTA/JSON-LD | Not verified | — | No QA settings mutation was made. |
| Policies | Policy pages and booking snapshot | Not verified | — | No QA booking/policy version was created. |
| SEO | Title/description/canonical/robots/OG/JSON-LD | Not verified | — | No SEO mutation was made. |
| Media upload/replace/delete | Admin media, Cloudinary, all consumers | Not verified | — | No QA upload was made; Cloudinary Admin API assertions were not run. |
| Availability/blackout | Availability API and booking picker | Not verified | — | No QA blackout was created. |
| Reward rule | Rewards and account dashboard | Not verified | — | No QA rule was activated. |
| Restricted role | Admin UI and direct actions | Not verified | — | No restricted-role credentials were supplied. |
| Concurrent edits | Public final state and audit log | Not verified | — | No two-admin fixture was supplied. |

## Bugs and findings

### BUG-001 — Medium — Mobile Contact page horizontal overflow

- Reproduction: open the DEV production build at `/contact` with a 390px viewport; run the public diagnostics test.
- Expected: `document.documentElement.scrollWidth <= 390` and no horizontal scroll.
- Actual: the page measured 408px; the main/container chain and a clipped eyebrow span were wider than the viewport.
- Evidence: Playwright assertion: `main ... scrollWidth: 408, clientWidth: 390`; the finding is in the failed mobile diagnostic output.
- Root-cause guess: a Contact layout child or fixed-width content is not constrained at the small breakpoint. The off-screen screen-reader labels also appear in the overflow source list, so inspect both visible and accessibility-only elements before fixing.
- Suggested fix: inspect the Contact page grid/form and its small-screen width constraints, then rerun the 390px route check. No fix was applied in this QA step.

### BUG-002 — Medium — Public pages do not emit canonical links

- Reproduction: load each primary public route in the production build and inspect the HTML head or `document.querySelector('link[rel="canonical"]')`.
- Expected: each indexable public route emits its correct absolute canonical URL; query-string variants should resolve to the same canonical path.
- Actual: the canonical element was `null` on every tested public route, including `/`, `/about`, `/packages`, `/stories`, `/contact`, and `/book`.
- Evidence: the Playwright desktop diagnostic recorded `canonical: null` for all 18 routes.
- Root-cause guess: `src/app/layout.tsx` defines title/description only, while `metadataFromSeo` adds a canonical only when an entity-specific SEO record has `canonicalUrl`; there is no site-wide fallback canonical metadata.
- Suggested fix: define a safe site-wide canonical strategy and preserve entity-specific overrides, then verify `view-source`, query variants, sitemap URLs and preview/noindex behavior. No fix was applied in this QA step.

### FINDING-002 — High verification blocker — Cloudflare Turnstile challenge requests return 400 in browser QA

- Reproduction: run the desktop public diagnostic with DEV network access; four requests to `https://challenges.cloudflare.com/cdn-cgi/challenge-platform/...` return 400 and produce generic browser console errors.
- Expected: third-party challenge resources load without console errors, or the DEV test mode provides a deterministic stub.
- Actual: challenge requests returned 400. The affected endpoints are third-party and no application route returned 4xx.
- Classification: environment/integration verification blocker, not yet a confirmed application bug.
- Suggested fix: provide a DEV Turnstile test key or deterministic test stub, then repeat the no-console/CSP checks.

### FINDING-003 — Low — Fresh production server cannot bind port 3000 in this workspace

- Reproduction: `npm start -- --hostname 127.0.0.1 --port 3000` returned `listen EACCES`; port 3000 was already occupied.
- Classification: local environment limitation. The built server ran successfully on port 3101.

The same port collision prevented a clean dev-server restart. The existing process reported itself as Next development mode and `/api/health` returned 200; it was left running untouched.

## Static risk found during source trace

Media metadata update and media soft-delete call only `revalidatePath("/admin/media")`. Public cached readers select media inside entity caches tagged by CMS entity, not by media ID. Therefore an alt-text, focal-point, public-flag or media-only delete can remain stale on public pages until the 300-second reader revalidation or an owning entity mutation. This is a source-level stale-content risk, not an end-to-end Pass/Fail claim; it should be verified and fixed in a separate implementation task.

## Top five problems / next checks

1. Fix and retest `/contact` at 390px for horizontal overflow.
2. Add and verify canonical links for every indexable public route.
3. Supply a DEV Turnstile test/stub configuration and repeat browser console/CSP checks.
4. Supply dedicated DEV QA staff and restricted-role credentials plus a seeded cleanup-safe fixture; run the guarded admin propagation suite.
5. Verify media-only alt/focal/public/delete invalidation on every consuming page and compare production-build versus dev-mode delays.

No application bug was fixed in this step. Stop here pending an explicit decision on which findings to address.

