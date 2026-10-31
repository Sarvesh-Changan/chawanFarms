# Chawan Farms UI audit

**Status: visual audit completed for logged-out pages against confirmed DEV data; authenticated account view not verified.** Date: 1 November 2026. User confirmed the hosted `.env.local` database is DEV. `npm.cmd run build` completed successfully against it. Playwright Chromium visited 31 distinct routes at 1440×900 and 390×844 touch (62 route/viewport captures including catalogue details). Lighthouse 12.8.2 ran on all 62 route/viewport combinations. Screenshots, viewport scroll captures, interaction captures and slow Home videos are saved in locally ignored `docs/qa/ui-audit/`. Account overview redirects to Login because no DEV customer session was available. No production URL or database was accessed.

## Summary and measurement record

| Measure | Result | Status / reason |
|---|---|---|
| Lighthouse performance / accessibility / best practices / SEO | 31 routes × 2 viewports; desktop averages 54.3 / 94.2 / 96 / 99; mobile 73.4 / 94.2 / 96 / 97.1 | Lighthouse lab scores; individual route data in `lighthouse/summary.json`. |
| LCP, CLS, INP / TBT | Lighthouse median LCP 4,897 ms desktop / 4,834 ms mobile; median TBT 346 / 333 ms; max CLS 0.003 / 0.001 | Lab results. Home-specific Playwright samples: desktop LCP 2,044 ms / TBT approx. 147 ms; mobile LCP 284 ms / TBT approx. 48 ms. Lighthouse INP absent; INP not verified. |
| Total JS / image bytes | Captured in `metrics.json` | `networkContentLengthBytes` sums response `Content-Length` values and may omit responses without that header; browser transfer-size totals can be 0 for cached/cross-origin resources. |
| Sections, page height in screens, whitespace between sections | Captured in `metrics.json` | Home is 7,940 px / 8.82 desktop screens and 13,074 px / 15.49 mobile screens; Home has 9 `<section>` elements. DOM gap values are in `whitespaceGaps` / `largeGaps`. |
| Failed/placeholder images | Captured after scrolling | Home has 0 failed `<img>` elements and 10 candidate empty media frames in the final run, plus loaded assets depicting unrelated pet-finder UI/dogs. Empty frames are not failed image elements. |
| Empty headings, duplicated copy | DOM and source inspected | Home location heading/body repeat the address; fixed Home section headings can render with empty datasets. `duplicateText` is in JSON. |
| Text/image contrast | Partial computed samples in `metrics.json`; overlay contrast not verified | Computed foreground/background samples do not include actual image pixels and gradients. |
| Horizontal overflow / console errors | No horizontal overflow; 28 generic HTTP 400 resource console messages across captures | The capture did not record the failing resource URL/type, so the 400s remain unresolved. Lighthouse contact network audit showed no 4xx. `ERR_ABORTED` requests during route navigation are separate. |
| Scroll transforms, parallax rate, reveal execution | Home motion samples and slow-scroll captures recorded | No continuous parallax observed on Home. Hero text has an entry transform; mosaic and stay-card reveals are mount/scroll-triggered; mobile coarse-pointer presentation is static. Samples are in `metrics.json`. |
| Distinct animation styles | Five named animations observed on desktop Home plus utility transitions; source includes additional Reveal, Parallax, CountUp and carousel paths | No Home parallax executed because no hero media is configured. The site has more motion paths than the compact set recommended in `MOTION_PLAN.md`. |
| Production build | `npm.cmd run build` completed against confirmed DEV | TypeScript, compilation, route generation and route listing completed. A prior loopback-only attempt logged ECONNREFUSED but was superseded. Generated Prisma client / `.next` are ignored artifacts. |
| Screenshot evidence | Captured and visually inspected | `home-{desktop,mobile}-full.png`, route-named full-page and `-screen-XX.png` files, interaction screenshots and `home-{desktop,mobile}-slow-scroll.webm`. |

The Home JSX source map and recommendations are detailed in [HOME_PLAN.md](HOME_PLAN.md). The checked-in docs are evidence from code and repository docs; runtime observations are explicitly separated.

## Page findings

Severity refers to visitor impact in the captured DEV dataset. Source-only findings are identified as such. Screenshot names are files in the ignored `docs/qa/ui-audit/` directory.

| ID | Page | Severity | Area | Finding | Evidence | Suggested fix |
|---|---|---|---|---|---|---|
| H-01 | Home `/` | Critical | Imagery / trust | Story cards show a pet-finder app screen and dogs; package/activity/accommodation media is largely blank. Hero is a solid forest panel rather than farm photography. | `home-desktop-full.png`, `home-mobile-full.png` | Replace with approved farm/stay/food photography; hide empty frames. |
| H-02 | Home `/` | High | Length / conversion | Home is 7,940 px (8.82 desktop screens) and 13,074 px (15.49 mobile screens), with 9 section elements, 19 activity/facility statements, four packages, accommodation, food, activities and a rewards/video-submission teaser. The Home gallery and explicit closing booking CTA are absent. | `home-desktop-full.png`, `home-mobile-full.png`, `metrics.json` | Reduce to the 6–8 blocks in `HOME_PLAN.md`; remove duplicates and empty media. |
| H-03 | Home `/` | High | Hierarchy / location | Location is second and repeats address as heading and body; abstract grid is labelled “Location map” but is not a real map. | `home-desktop-full.png`, `home-mobile-full.png` | Move below stay proof, show address once and label only a verified map/pin. |
| H-04 | Home `/` | High | Content accuracy | Nature section lists 19 claims (rafting, jungle trail, fishing, campfire) and duplicates Activities; current confirmation is unclear. | `home-desktop-full.png`, `home-mobile-full.png`, `NatureFeature.tsx` | Replace with three verified farm-experience pillars; link to Activities. |
| H-05 | Home `/` | High | Content wiring | Experiences are fetched but unused; “Stories from the farm” uses Stories, with unrelated or blank covers. | `home-desktop-full.png`, `HomeSections.tsx` | Wire and label the intended source; show only approved, correctly illustrated cards. |
| H-06 | Home `/` | High | Conversion | Four package choices have visible rates but no card photography; the final rewards/video-submission block does not close on the primary stay enquiry. The dedicated `FinalCta` component is not mounted. | `home-desktop-full.png` | Lead with 2–3 complete offers, concise experience proof and one final booking action. |
| H-07 | Home `/` | High | Mobile layout | Fixed Call/WhatsApp/Enquire bar overlaps content at mobile width; Book and Contact show clearer form/card overlap. | `home-mobile-full.png`, `book-mobile-full.png`, `contact-mobile-full.png` | Add viewport content inset and verify hide behavior with focused fields/keyboard. |
| P-01 | Packages `/packages` | High | Imagery / hierarchy | Four package cards have large blank beige media panels. Catalogue is readable, but the rust closing CTA adds substantial visual weight. | `packages-desktop-full.png`, `packages-mobile-full.png` | Add accurate photos or remove empty panels; tighten intro and shared close. |
| P-02 | Package details | High | Imagery / content | Package details load with rates, but image panels are empty; verify rate validity and conditions by option. | `packages-detail-package-a-desktop-full.png` and mobile counterpart | Use approved option-specific images; keep rate, conditions and enquiry adjacent. |
| A-01 | Accommodation `/accommodation` | High | Imagery | Catalogue has blank media panels before the option titles. | `accommodation-desktop-full.png`, `accommodation-mobile-full.png` | Add accurate stay photos or render compact cards without empty frames. |
| A-02 | Accommodation details | High | Imagery / data | Some accommodation media is blank; Home Dormitory shows a red barn exterior rather than a clear sleeping space. | `accommodation-detail-dormitory-desktop-full.png`, `home-desktop-full.png` | Use accurate option-specific photos and confirm amenities/capacity. |
| AC-01 | Activities `/activities` | High | Imagery | Activity listing and Home tiles have empty image frames, so activity names lack visual proof. | `activities-desktop-full.png`, `home-desktop-full.png` | Add accurate approved media or remove empty frames and use a compact list. |
| AC-02 | Activity details | High | Imagery / content | Activity pages load, but crops/claims need client review; details lack distinctive farm imagery. | `activities-detail-*.desktop-full.png` | Add accurate images and preserve availability/safety/extra-cost detail near the CTA. |
| S-01 | Stories `/stories` | Critical | Content trust | One cover is an unrelated engineering-course screen; two are gradient/logo placeholders. Repeated “Farm experience” tags and sparse excerpts weaken the cards. | `stories-desktop-full.png`, `stories-mobile-full.png` | Unpublish unrelated media; require relevant approved covers and excerpts or hide incomplete stories. |
| G-01 | Gallery `/gallery` | Critical | Content trust | Gallery shows lost-pet finder UI, pet listings, dog photos, a generic map, barn and unrelated red event room. | `gallery-desktop-full.png`, `gallery-mobile-full.png` | Unpublish unrelated assets in DEV content review; publish only accurate farm imagery with meaningful alt text. |
| F-01 | Food `/food` | High | Visual weight | Menu is a long text inventory with open category panels and no food photography; extra-charge labels are very prominent. | `food-desktop-full.png`, `food-mobile-full.png` | Lead with approved meal imagery and compact menu highlights; keep extra costs clear but quieter. |
| FAQ-01 | FAQ `/faqs` | Medium | Spacing / hierarchy | One question is visible with large gaps around it; the shared rust close is disproportionately large for this short page. | `faq-desktop-full.png`, `faq-mobile-full.png` | Tighten FAQ spacing and use a shorter shared close/contact link. |
| R-01 | Rewards `/rewards` | Medium | Empty state / copy | Redemption panel contains no visible tiers, only placeholder explanation. Four steps and large shared close make a text-heavy page. | `rewards-desktop-full.png`, `rewards-mobile-full.png` | Show active tiers only; compact explanation and state approval requirements beside earning claims. |
| C-01 | Contact `/contact` | Critical | Mobile accessibility | Sticky bar obscures Contact card text at mobile width; location repeats in contacts, directions and “How to reach us.” | `contact-mobile-full.png`, `contact-mobile-screen-01.png` | Add bottom inset or suppress the bar appropriately; consolidate location and test with keyboard open. |
| B-01 | Book `/book` | Critical | Mobile form | Sticky bar overlaps the calendar/date flow; dates and guest fields create a long first-step scroll before Continue. | `book-mobile-full.png`, `book-mobile-screen-01.png` | Add safe bottom space around controls and verify focused-field hiding on a device. |
| AB-01 | About `/about` | Medium | Imagery / duplication | Four text-only feature cards repeat Home claims; rust close repeats Home headline and occupies a large area. | `about-desktop-full.png`, `about-mobile-full.png` | Add approved documentary photography and a distinct farm story; shorten the shared close. |
| L-01 | Login `/login` | Medium | Form / accessibility | Page rendered, but successful login and error/verification states were not exercised without a DEV account. | `login-desktop-full.png`, `login-mobile-full.png` | Test validation, password reveal, keyboard and session flow with DEV-only credentials. |
| SU-01 | Signup `/signup` | Medium | Form / accessibility | Page rendered, but submit, verification feedback and errors were not exercised. | `signup-desktop-full.png`, `signup-mobile-full.png` | Test a DEV-only signup/mail sink; review mobile keyboard and focus/error placement. |
| ACC-01 | Account overview `/account` | High | Access / personalization | Direct access redirects to `/login?callbackUrl=/account`; no authenticated dashboard view was captured. | `account-desktop-full.png`, `account-mobile-full.png`, `metrics.json` | Capture with a DEV customer session and review data/empty states. |
## What already works in source and should be preserved

- Clear primary action vocabulary: â€œPlan your stayâ€ routes to `/book`; package cards can route into a package enquiry.
- Public package, accommodation, activity and story readers filter to published content; story reader also checks publication timing and consent for submission-backed stories.
- Media uses reserved aspect boxes and source-level responsive Cloudinary `sizes`; hero image is marked priority.
- Mobile sticky contact bar adapts to configured phone/WhatsApp and hides while a form field is focused; it accounts for bottom safe-area inset.
- Navigation dropdown includes keyboard arrow/Escape handling and supports hover only when fine pointer is detected; focus styles are defined in source.
- `prefers-reduced-motion` handling exists in hero, `Reveal`, parallax, counters, carousel scrolling, and global animation CSS.
- Login/signup are shared `AuthForm` implementations; account routes are customer-gated.
- Empty states are intentionally present on catalogues. The issue is Home section weight and approval gating, not the existence of empty feedback itself.

## Motion audit

Source inventory: 8 named global keyframes; Hero line/copy reveal and scroll-linked background; mosaic and stay-card stagger; carousel snap/reveal; lazy Motion `Reveal`; lazy Motion `ParallaxImage`; `CountUp`; plus utility transitions and card/image hover states. On captured Home desktop, observed names were `hero-line-in`, `hero-copy-in`, `bounce`, `nature-mosaic-in`, and `stay-card-in`; transition durations included 0.15s, 0.2s and 0.28s. The desktop hero entry translation reached 18px then settled; this is an entrance animation, not scroll parallax. No continuous Home element parallax was observed, and the Home hero has no configured media to create a parallax scene. Touch/mobile Home presentation was static. Exact samples are in `metrics.json`.

Notable risks: multiple reveal/parallax implementations and defaults; reduced-motion coverage varies by utility transition; page-route transitions do not exist. Lighthouse Home mobile also flagged the small header tagline and Stories tag for contrast, and an accessible-name mismatch on the visible “Explore” scroll cue. See [MOTION_PLAN.md](MOTION_PLAN.md) for one proposed set of values.

## Top 15 issues in priority order

1. **Critical — Gallery asset trust:** unrelated pet-finder UI, pets, dog photos and unrelated venue imagery appear as farm gallery content. `gallery-desktop-full.png`.
2. **Critical — Story asset trust:** an engineering-course screenshot and two gradient/logo placeholders appear as farm stories. `stories-desktop-full.png`.
3. **Critical — Mobile booking/contact obstruction:** fixed CTA covers parts of the calendar/date flow and contact card at 390px. `book-mobile-screen-01.png`, `contact-mobile-screen-01.png`.
4. **High — Farm photography is incomplete or inaccurate:** Home has ten candidate empty media frames and unrelated/weak imagery; captured `<img>` failure count is zero, which does not make the assets suitable. `home-mobile-full.png`.
5. **High — Home is too long for mobile:** 13,074px / 15.49 screens, nine sections; several repeated or low-proof blocks dilute the stay enquiry. `home-mobile-full.png`.
6. **High — Mobile Home Lighthouse performance:** score 66, LCP 5,687ms and TBT 278ms; desktop score is 98 on Home, while site-wide desktop average is 54.3. `lighthouse/home-mobile.json`.
7. **High — Site-wide desktop performance is weak:** average Lighthouse performance 54.3/100 across 31 routes; median LCP 4,897ms. `lighthouse/summary.json`.
8. **High — Home claims need approval:** NatureFeature asserts 19 activities/facilities, duplicating the Activities page and requiring fact verification. `home-desktop-full.png`.
9. **High — Home content wiring and conversion:** fetched experiences are unused; Stories fill that slot; Gallery and the dedicated FinalCta component are not mounted. Current closing Rewards teaser asks guests to submit video, not plan a stay. Source: `HomeSections.tsx`.
10. **High — Empty/weak catalogue cards:** package, stay and activity cards frequently reserve large blank media panels. `packages-desktop-full.png`, `accommodation-desktop-full.png`, `activities-desktop-full.png`.
11. **High — Food page lacks visual appetite appeal:** a long text menu has no food photography. `food-mobile-full.png`.
12. **High — Generic closing panel dominates short pages:** the oversized rust CTA repeats across routes and outweighs FAQ/Rewards content. `faq-mobile-full.png`, `rewards-mobile-full.png`.
13. **Medium — Contrast and accessible name:** Lighthouse identified 4.18:1 header tagline and 4.29:1 Stories tag contrast, plus Explore cue accessible-name mismatch. `lighthouse/home-mobile.json`.
14. **Medium — Unresolved browser 400s:** 28 generic resource errors recorded across captures; capture did not record their URLs/types, so source is unknown. `metrics.json`.
15. **Medium — Motion language is fragmented:** multiple CSS and Motion reveal/parallax paths coexist; no Home scroll parallax was observed and no hero photo is configured. `home-desktop-slow-scroll.webm`, `metrics.json`.

## Evidence capture path

The requested destination is `docs/qa/ui-audit/` and is locally ignored by its directory `.gitignore`. It contains screenshots, viewport captures, interaction states, Home slow-scroll videos, `metrics.json`, Lighthouse JSON per route/viewport and `lighthouse/summary.json`. The server was local and served from the confirmed DEV database. `INP` is not reported by Lighthouse in this lab-only run; authenticated account overview and form submission flows remain unverified because no DEV customer credentials or mail sink were supplied.

