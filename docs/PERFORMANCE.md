# Public performance QA

Targets for the public experience are LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms, and a Lighthouse mobile performance score ≥ 90.

## Measurement status

| Route | Before | After | Status |
|---|---|---|---|
| `/` | Not measured | Not measured | Lighthouse CLI and a Chrome/Chromium executable are not available in this workspace |
| `/packages` | Not measured | Not measured | Lighthouse CLI and a Chrome/Chromium executable are not available in this workspace |
| `/gallery` | Not measured | Not measured | Lighthouse CLI and a Chrome/Chromium executable are not available in this workspace |
| `/contact` | Not measured | Not measured | Lighthouse CLI and a Chrome/Chromium executable are not available in this workspace |

The code-level QA completed in this step preserves reserved media aspect ratios, uses Cloudinary responsive sizes, keeps the hero priority image path, and limits new motion to transform/opacity. Automated unit tests include jest-axe coverage for the newly changed story/closing/footer surfaces. A real before/after Lighthouse run still requires the production server, a reachable database/content environment, and a browser runner; those numbers must be recorded before launch rather than estimated.

## Remaining measurement

Run each route on a throttled mid-range Android profile in a clean production build and record the Lighthouse JSON values for performance score, LCP, CLS, and INP in the table above. Repeat once after content/media has been populated, since media dimensions and network delivery materially affect the result.
