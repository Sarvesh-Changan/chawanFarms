# Mobile responsive audit

## Baseline

The requested user screenshots were visually inspected. The repository also contains a prior Playwright/Lighthouse audit dated 1 November 2026: 31 logged-out routes at 1440×900 and 390×844, with screenshot evidence in the locally ignored `docs/qa/ui-audit/` directory. It recorded no document horizontal overflow at those two widths, identified the Home inset placeholder, and reported mobile sticky CTA obstruction on Contact and Book. It did not include the requested viewport matrix, authenticated account pages, or authenticated admin pages.

I ran `npm run build` successfully before application edits. I then attempted the new audit against a loopback production server, with no production URL or credentials. The server returned HTTP 500 because route rendering attempted database connections that the sandbox denied (`EACCES`). I stopped the server and did not retry the hosted connection. Therefore the resulting one-route smoke sample is recorded in ignored `docs/qa/responsive/metrics.json` as a failed capture, not as a valid visual or responsive baseline. The requested nine-viewport measurements and before screenshots could not be completed in this environment.

## Source and screenshot findings

| ID | Page | Severity | Evidence | Planned fix |
|---|---|---|---|---|
| H-01 | Home | Fixed in source | The screenshot had a duplicated `//` because the shared eyebrow adds a marker and CMS content also began with markers. `HomeHero` now strips all leading markers; the regression test covers `// //`. | Recheck in browser when the local page can load data. |
| H-02 | Home | Fixed in source | The screenshot showed the `CROPS & TREES` inset badge without a photo. `HomeHero` now omits both inset layers when their image data is absent and removes the text fallback badges. | Recheck in browser with empty and populated media states. |
| H-03 | Home | Partly fixed | The hero grid already stacks below `lg`; the mobile inset badges now stay within the media frame and the heading has a smaller fluid minimum. | Verify reading order, real-image spacing, and overlap at 320–430px in a browser. |
| H-04 | Public header / Home | Partly fixed | Supplied refresh screenshot shows only an underlined `Home` strip; its exact browser state could not be reproduced. Mobile dialog now uses a stable dynamic viewport height and safe-area padding. Existing header remains sticky and does not hide on scroll. | Reproduce open/close, scroll, and reload states on device; confirm no scroll restoration or browser chrome crop remains. |
| H-05 | Book and Contact | High | Historical DEV audit reports the sticky contact bar covers portions of the calendar/date flow and Contact content at 390px. | Verify sticky-bar occlusion with focus and keyboard states; keep mobile content inset and safe areas. |
| H-06 | Account and admin | High | Historical audit did not authenticate these page families; current sandbox run had no QA credentials. | Validate against the provided seeded QA accounts when available. |

## Audit runner

`npm run responsive:audit` uses Playwright and `tsx`, reads public URLs from `/sitemap.xml`, adds auth/account/admin route templates, enables touch, saves full-page captures under ignored `docs/qa/responsive/`, writes route/viewport metrics to `metrics.json`, and records findings here. `RESPONSIVE_AUDIT_BASE_URL` selects the server; `QA_SUPER_ADMIN_EMAIL` / `QA_SUPER_ADMIN_PASSWORD` and `QA_CUSTOMER_EMAIL` / `QA_CUSTOMER_PASSWORD` enable authenticated captures. Optional `RESPONSIVE_AUDIT_ROUTE` and `RESPONSIVE_AUDIT_VIEWPORT` filters support a targeted smoke run.

The audit checks document overflow and candidate elements, small interactive controls, text and input font size, clipping, sibling intersections, image sizing/loading, placeholder labels, console errors, and horizontal scroll offset. It exits unsuccessfully when it records findings. Sticky occlusion and overlapping siblings need visual review; its geometric overlap count is a triage signal, not an automatic assertion that every intersection is a defect.

## After-fix verification

Not yet measured. A valid after run, Lighthouse mobile comparison, and 1440px before/after screenshots require a working local or approved QA database and QA customer/admin sessions. Do not point this audit at production. Source changes include the intended eyebrow text correction and removal of empty inset badges; no 1440px screenshot comparison was possible, so pixel identity at desktop remains unproven.
