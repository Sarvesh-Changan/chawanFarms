# UI improvement report

## Scope and evidence

The production build was run locally against the user-confirmed DEV database at `http://127.0.0.1:3104`; port 3000 was left free. Lighthouse 12.8.2 and Playwright Chromium were used. Before evidence is the saved 31 October 2026 run on port 3103; after evidence is the 1 November 2026 run on port 3104. The Lighthouse runner used simulated desktop (1440×900) and mobile (390×844) profiles. INP is unavailable in Lighthouse lab runs, so TBT is reported as the lab responsiveness proxy. These captures do not represent field data or real-device performance.

Screenshots, scroll frames, videos, Lighthouse JSON and browser measurements are git-ignored under `docs/qa/ui-audit/`. `metrics.json` covers Home, Packages, Gallery and Contact at both viewports. The browser pass also checks horizontal overflow at 360, 390, 768, 1024 and 1440 px.

## Lighthouse before and after

Scores are Performance / Accessibility / Best Practices / SEO. LCP and TBT are milliseconds; transferred bytes are total page bytes. INP was not available in these lab runs.

| Route | Viewport | Before scores | After scores | LCP before → after | CLS before → after | TBT before → after | Bytes before → after |
|---|---|---:|---:|---:|---:|---:|---:|
| Home | Desktop | 98 / 96 / 96 / 100 | 50 / 95 / 96 / 100 | 1,186 → 5,173 | 0 → 0 | 0 → 332 | 923,141 → 604,603 |
| Home | Mobile | 66 / 96 / 96 / 100 | 39 / 95 / 96 / 100 | 5,687 → 7,964 | 0 → 0.0001 | 278 → 5,535 | 748,086 → 586,651 |
| Packages | Desktop | 57 / 96 / 96 / 100 | 33 / 96 / 96 / 100 | 5,226 → 5,674 | 0 → 0 | 346 → 4,483 | 643,904 → 655,813 |
| Packages | Mobile | 79 / 96 / 96 / 100 | 37 / 96 / 96 / 100 | 4,701 → 6,063 | 0 → 0.0169 | 220 → 8,789 | 616,338 → 628,799 |
| Gallery | Desktop | 52 / 96 / 96 / 100 | 35 / 96 / 96 / 100 | 5,548 → 4,802 | 0 → 0 | 474 → 2,365 | 740,120 → 596,602 |
| Gallery | Mobile | 77 / 96 / 96 / 100 | 48 / 96 / 96 / 100 | 5,244 → 5,141 | 0 → 0 | 218 → 2,741 | 722,908 → 579,463 |
| Contact | Desktop | 45 / 92 / 96 / 100 | 27 / 92 / 93 / 100 | 4,863 → 5,084 | 0.0020 → 0 | 400 → 2,525 | 1,028,388 → 615,937 |
| Contact | Mobile | 70 / 92 / 96 / 100 | 54 / 92 / 93 / 100 | 4,827 → 4,311 | 0 → 0 | 425 → 3,095 | 1,012,110 → 599,660 |

The requested mobile performance targets are **not met**: Home, Packages, Gallery and Contact score 39, 37, 48 and 54. Their LCP values also exceed 2.5 s. CLS remains below 0.1 on all four. The before and after captures were taken in separate local runs; the large TBT increase makes performance-score comparisons especially sensitive to run conditions. The recorded values are preserved as observed, not adjusted. The 8 Lighthouse reports and the raw summary parts are available in the ignored after evidence directory.

Total transferred bytes fell on Home, Gallery and Contact, and rose slightly on Packages. The after resource summaries report 0 transferred image bytes on these routes. Browser checks saw zero broken image requests; Home rendered one SVG illustration fallback and Packages rendered four neutral photo fallbacks. This low image weight reflects the missing approved media in DEV and does not demonstrate image-led page performance.

## Home changes and composition

The implemented conditional order is:

1. Hero with Settings headline/subline, a full `svh` frame, `/book` primary action, configured secondary contact actions, scroll cue, and layered illustration fallback.
2. Up to three photo-qualified package choices.
3. Two to four tagged, high-resolution full-bleed farm scenes.
4. Up to three photo-qualified experience cards in the existing non-autoplay snap slider.
5. Up to two consented, photo-qualified story cards.
6. Short food preview with a real published menu category and a distinct tagged image.
7. Three curated gallery images with a View all link.
8. Compact configured location/contact strip.
9. Closing Plan your stay action band.

In the current DEV data only **Hero, Location, and Closing action** rendered. Stays, scenes, experiences, stories, food and Gallery proof stayed hidden because no media met the marketing approval, dimension, alt-text and curation-tag rules. No empty section heading rendered. No current photo was reused across Home sections.

Removed from Home usage (their routes, source data and reusable components remain):

- Owner feature: move the farm introduction to About; it adds a second welcome before stay choices.
- Fixed 19-item NatureFeature list: remove unverified and repeated claims; show confirmed activities on Activities.
- Separate Accommodation block: merge the stay decision into package choices and leave inventory on Accommodation.
- Expanded Food accordions: shorten to an image-backed menu teaser and keep the full menu on Food.
- Separate Activities list: merge into a small experience-card group and leave depth on Activities.
- Rewards video teaser: remove from first-visit conversion flow and keep Rewards on its dedicated page.

Gallery proof and final CTA were added to the render composition, both hidden or minimal when their data requirements are not met.

## Browser findings

| Page / viewport | Measured result | Visual evidence |
|---|---|---|
| Home, desktop | 2,707 px / 3.01 screens; 3 semantic sections; 0 failed images; 1 fallback illustration; no large inter-section gap | `home-desktop-full.png`, `home-desktop-scroll-01.png`–`03.png`, `home-slow-scroll-desktop.webm` |
| Home, mobile | 2,908 px / 3.45 screens; 3 semantic sections; 0 failed images; 1 fallback illustration; primary CTA is unobscured; sticky contact appears after the hero | `home-mobile-full.png`, `home-mobile-menu-open.png`, `home-mobile-scroll-01.png`–`03.png`, `home-slow-scroll-mobile.webm` |
| Packages, desktop | 2,276 px / 2.53 screens; 4 neutral photo fallbacks; no broken images | `packages-desktop-full.png`, `packages-desktop-scroll-01.png`–`02.png` |
| Packages, mobile | 3,949 px / 4.68 screens; 4 neutral photo fallbacks; no horizontal overflow | `packages-mobile-full.png`, `packages-mobile-scroll-01.png`–`04.png` |
| Gallery, desktop | 1,822 px / 2.02 screens; explicit curated-empty state; no placeholders or broken images | `gallery-desktop-full.png`, `gallery-desktop-scroll-01.png`–`02.png` |
| Gallery, mobile | 2,107 px / 2.50 screens; compact empty state, no large blank gallery frame | `gallery-mobile-full.png`, `gallery-mobile-scroll-01.png`–`03.png` |
| Contact, desktop | 2,712 px / 3.01 screens; 1 blocked external resource (`ERR_NETWORK_ACCESS_DENIED`); duplicated address and form timing-help text | `contact-desktop-full.png`, `contact-desktop-scroll-01.png`–`03.png` |
| Contact, mobile | 4,062 px / 4.81 screens; same repeated address and timing-help copy; no horizontal overflow | `contact-mobile-full.png`, `contact-mobile-scroll-01.png`–`04.png` |

The non-Home catalogue templates render their content through non-semantic wrappers, so the script's semantic `<section>` count is zero there; this is not a claim that those pages have no visual content blocks. No large vertical gap over 75% of viewport height was measured on these four routes. Duplicate text detection found the configured address twice on Contact and the same minimum-fill-time hint three times. The failed external resource is consistent with the local browser network restriction; its exact cause was not independently verified.

Horizontal overflow passed at all five widths for Home, Packages, Gallery and Contact. Home has one H1, no duplicate headings or paragraphs and no empty headings; these checks also passed for the other captured pages. Accessibility scores were 92–96. The sticky contact bar no longer covers the Home hero CTA. Playwright checks passed for the mobile bar, reduced motion, and page composition.

## Motion measurements and limits

- The browser found no rendered eligible Home scene or slider, so **no real parallax rate or slider snap behavior was measurable**. Implementation rates are scene 0.12, hero photo 0.82 and inner catalogue detail photo 0.72; these are source values, not observed DEV rates. The available hero is a static illustration.
- Reduced-motion emulation reported 0 hidden reveals and 0 parallax scenes. Motion unit and e2e checks passed. Card-image hover, reveal-trigger timing, dropdown animation and route-transition visual deltas were not measurable on Home because eligible photo cards/scenes were absent; no claim is made that those deltas were measured.
- There is one external resource error on Contact during browser capture; Home, Packages and Gallery had no page errors.
- Playwright Chromium mobile emulation is not a real-device test. iOS Safari, Android Chrome, physical-device scrolling, and Save-Data network behavior remain **not verified**.

## Assets and facts blocking the planned visual result

D-14 in `docs/OPEN_QUESTIONS.md` lists the original farm/stay/activity/food/landscape photos, minimum dimensions, crops/focal points, alt text and client approval/tagging needed. Public media attached to published content does not need a separate approval tag to render. Home feature scenes still need the `home-scene` tag, and the Home food image still needs `home-food`. Hero, stays, scenes, Activities, Stories and Gallery need suitable, rights-cleared photos; identifiable people and minors need documented consent. Client confirmation is also still needed for current activity claims, package terms/rates, accommodation facts, menu scope and travel directions listed in D-14 and the cited open questions. No facts, prices, reviews or amenities were invented.

## Follow-up: public CMS media and hidden-document transition error

The media visibility issue came from applying Home marketing-photo curation rules to ordinary public content, plus an `isFeatured` filter on Gallery. Those checks hid admin-uploaded media even when attached to published public content. Public image rendering now uses public-media checks (image kind and Cloudinary public ID) and relies on the existing public-reader visibility gates. Marketing-photo criteria remain limited to prominent hero/parallax placement; special Home scene and food placements still require their tags. Stories without an image remain visible with a neutral fallback.

The recoverable `InvalidStateError` occurred at the public layout's React `ViewTransition` boundary when the browser document became hidden. That boundary and its unused transition CSS were removed; route navigation remains immediate. The Playwright route-navigation check saw no `InvalidStateError`, `Document hidden`, or aborted-transition console message.

After the fix, a production build served against DEV data showed 6 Gallery images on desktop and mobile, 1 Story cover plus 2 no-cover fallbacks, 1 Activity image plus 7 no-image fallbacks, and 2 Accommodation images plus 2 fallbacks. There were no failed image loads on those routes. Packages had 0 associated images and 4 fallbacks, so their photos remain blocked by missing media associations in DEV. Home still has no configured photo hero and displays its SVG fallback. The Story cover is attached and publicly visible in DEV; whether its content association is correct needs client/data review.

Focused unit tests passed (10 tests across 3 files), the four Home composition e2e tests passed, lint passed, typecheck passed, and the production build passed. These checks used the local production server connected to DEV only. Physical-device behavior, authenticated account pages, and real-device iOS/Android parallax remain unverified. Lighthouse was not rerun specifically for this follow-up, so no new post-fix scores are claimed.

