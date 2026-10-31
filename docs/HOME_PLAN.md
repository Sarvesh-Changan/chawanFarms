# Home page plan

## Implementation status (2026-11-01)

The implementation follows the visitor-first order below. A section is omitted when its required source data, image quality or scene-specific curation is absent; missing content does not leave a blank heading. `docs/OPEN_QUESTIONS.md` D-14 lists the original approved photos and captions still needed. The 2–4 full-bleed feature scenes require gallery assets tagged `home-scene`, at least 1920×1080, a meaningful alt text, no provisional PDF tag, and a distinct media record. Only the hero photo is prioritized. Touch, reduced-motion, and Save-Data users receive static imagery.

| Rendered order | Verdict | Treatment | Data and fallback |
|---|---|---|---|
| Hero | KEEP | Full viewport with photo, contrast overlay and image parallax; otherwise layered gradient and farm-line illustration. | Settings headline/subline; `/book` primary action; configured WhatsApp and phone actions. No photo card placeholder. |
| Stay choices | KEEP | Up to three image-led package cards, no filters on Home. | Published package, attached public image and active adult rate required. Full inventory on Packages and Accommodation. |
| Farm feature scenes | MERGE | 2–4 sticky clipped full-bleed photo scenes between content blocks, with one short approved caption each. | `GalleryItem.media.tags` includes `home-scene`; 1920×1080 minimum; hide without suitable photos. Native sticky/clip-path, never `background-attachment: fixed`. |
| Experiences | MERGE | Existing scroll-snap `ExperienceCarousel`, maximum three photo cards; no autoplay. | Published Experience with attached public image. Full list remains under Activities. |
| Stories | SHORTEN | Up to two consented story cards with photo crop and excerpt. | Existing public story consent/status gate plus attached public cover image. Empty section hidden; full content at Stories. |
| Food preview | SHORTEN | One split image/text block with up to four real menu items. | Published menu category and featured photo tagged `home-food`; otherwise hidden. Full menu on Food. |
| Gallery proof | KEEP | Three approved image tiles, first larger, with View all. | Featured public images only; excludes hero, scenes, food, and shown story covers to avoid reuse. Hide when empty. |
| Location | SHORTEN | Compact address/contact and configured map search, below proof. | Settings address/phone only. No guessed coordinates or repeated directions. Hide when empty. |
| Closing action | KEEP | Quiet full-width CTA band with Plan your stay, configured WhatsApp and Call. | Existing Settings copy where present; no invented stats, reviews, or offers. |

Removed from Home usage: Owner feature (belongs on About), the hardcoded 19-item NatureFeature claims (unverified/duplicative), separate Accommodation list (merged into stay choices), the open Food menu accordion (reduced to conditional image-backed preview), extra Activities list (merged with Experiences), and Rewards video teaser (dedicated Rewards route). Gallery and final CTA, previously declared but not rendered, now render only when their requirements are met. No page/data component or file was deleted.

Desktop keeps side-by-side cards and full-bleed scenes. Mobile stacks stay choices, uses touch swipe on the existing snap carousel, crops images with reserved aspect ratios, and disables parallax. Forms and account flows stay motion-light.

This plan was applied to the Home composition during the UI improvement task. Lighthouse data and per-route browser metrics are in the ignored `docs/qa/ui-audit/` directory. The "Current sections and verdicts" table below preserves the pre-change audit snapshot; the implemented order and runtime DEV composition are recorded above and in `docs/UI_IMPROVEMENT_REPORT.md`.

## Pre-change sections and verdicts

Actual order is HomeHero → optional owner feature → location → story cards → NatureFeature → packages → accommodation → food → activities → rewards → footer. Gallery and FinalCta are named in the declared order but omitted by the render switch.

| Current section | Purpose / visitor value | Duplication, completeness, visual weight | Verdict |
|---|---|---|---|
| Hero | Establish farm stay and route to enquiry; primary and secondary links are `/book` and `/experiences`. | Highest weight. Background depends on a Settings photo/video; otherwise it becomes solid forest. Exact headline, crop, contrast and CTA clarity not browser-verified. | **KEEP** — one dominant, specific promise and one primary “Plan your stay” action. Use a real approved photo. |
| Owner feature | Personal welcome and trust. | Conditional on Settings display flag and media; adds unplanned block immediately after hero. | **MERGE** into a short “Meet the farm” card within About or a compact trust note lower on Home. Do not show an empty frame. |
| Location | Help Mumbai/Pune visitors orient themselves and reach the property. | Appears unusually early, before proof of what a stay includes; current heading/body repeat address; map defaults to decorative abstract art, not a verified route map. | **SHORTEN** and move below stay proof to a compact location/travel strip. Remove repeated address. |
| “Stories from the farm” (actually published stories) | Social proof and editorial discovery. | Hidden if no published stories; story records are distinct from fetched Experiences. Another Story index exists. | **SHORTEN** to at most 2 consented, photo-backed cards; omit until such stories exist. Link to Stories. |
| NatureFeature (“Why Chawan”) | Explain the farm experience and reassure about activities. | High text weight: fixed list of 19 facilities/activities plus separate Activities page; only image mosaic if ≥3 gallery photos. Several items require client confirmation under PRD/open questions. | **SHORTEN** to three verified reasons and move full list to Activities; use a three-photo mosaic only when approved images exist. |
| Packages | Give a concrete offer and price context; directly supports enquiry. | Strong conversion value, but active published package/rate completeness unknown. Current empty state keeps heading, blank-space-like panel and link. | **KEEP** — show up to 3 clear stay choices with known rate/conditions and package enquiry. Hide the section if no published, decision-ready package exists. |
| Accommodation | Explain sleeping options. | Duplicates package/accommodation routes; shown after packages. Empty heading/message stays visible. Photo availability unknown. | **MERGE** into packages as a short “Where you’ll sleep” detail or a single featured stay card; keep full inventory on Accommodation. |
| Food | Help judge suitability and authenticity. | The Home shows first two menu categories as open accordions and links to Food. Menu and photo completeness unknown; duplicative detail. | **SHORTEN** to one approved food image plus a few actual menu highlights; full menu on Food. Hide until items/media are approved. |
| Activities | Show family/group appeal. | First four activities; repeats long NatureFeature list and full Activities page. Media completeness unknown. | **MERGE** with three farm-experience pillars; keep up to 3 high-value activities and link to Activities. Omit unsupported/unsafe entries. |
| Gallery | Proof via real imagery. | Data is fetched, but current Home never renders the gallery section. | **KEEP** as a small 3–5 image proof strip only if real images exist; otherwise hide. |
| Rewards | Repeat visit/community loop. | Always renders and uses fixed promises even without an active rule; lower priority for first-time trip planning. Dedicated Rewards route. | **REMOVE** from the primary Home flow. Keep a small footer/navigation link or show a compact block only when a current, approved rule is active. |
| Final CTA | Convert after the visitor has context. | `FinalCta` exists but current composition omits it; hero/header/sticky bar already lead to `/book`. | **KEEP** as one calm close with primary “Plan your stay” and secondary call/WhatsApp if configured. |
| Header, sticky CTA, footer | Persistent navigation/contact and trust/legal info. | Sticky CTA is mobile-only and fixed; keyboard focus hides it. Potential coverage and mobile layout require browser inspection. | **KEEP** with one consistent enquiry destination and validated contact settings. |

## Proposed conversion order

1. **Hero** — one approved, immersive farm photo; short headline for a farm stay near Kolad; primary “Plan your stay” and optional WhatsApp. No invented travel times, amenities or rates.
2. **Choose your visit** — 2–3 package/stay options with rate, meal inclusion, group/child conditions only when the CMS data and client decisions support them. This answers “what can we book?” early.
3. **What a day here feels like** — three approved experience pillars (farm, outdoors, shared meals), supported by candid real photos and linked to Activities. Never use the hard-coded list as proof until all items are client-approved.
4. **Where you’ll stay** — one compact accommodation treatment inside or immediately after package cards; full inventory lives on Accommodation.
5. **Farm food** — one image and concise, currently published menu examples; link to Food.
6. **Proof of place** — 3–5 approved images, optionally up to two consented guest stories when available. Hide each source independently when empty.
7. **Plan your visit** — compact address/map link and practical directions only after client confirms travel notes. Do not claim distance or drive time.
8. **Closing enquiry CTA** — “Plan your stay” to `/book`, with phone/WhatsApp only when configured.

Target is 6–8 purposeful blocks plus global chrome. The two strongest visual moments should be the hero and “What a day here feels like”; package cards need the clearest conversion hierarchy. Reserve an optional third feature image for an approved shared meal/stay proof strip.

## Section design spec

| Section | Visual treatment | Data source | Motion | Missing-data behavior |
|---|---|---|---|---|
| Hero | Full-bleed 16:9 desktop / art-directed 4:5 mobile still; readable solid gradient; copy bottom-left; one primary button. | Settings hero and approved original media; `/book` CTA. | Copy fade/up 18 px, 550 ms, 80 ms line/group stagger. Optional image parallax ≤12 px on large pointers only; static on mobile/save-data/reduced motion. | Use plain brand-color panel with text. No stock photo, poster frame or video when absent. Do not hide the primary action. |
| Stay choices | Three-card grid desktop; compact stacked list mobile (not auto-rotating slider). Price and conditions visually close to each choice. | Published Packages + active valid rates; Accommodation relation; CMS media. | One-time reveal 18 px/550 ms, ≤80 ms stagger; hover image scale 1.03 over 280 ms only for fine pointer. | Hide whole block when no ready published package/rate; no blank title, “from” price without rate, or invented conditions. |
| Farm experience | Asymmetric split: copy and three verified pillars beside one large real photo; optional 2-image support mosaic. | Client-approved Home copy/Settings or published Activity CMS items, filtered by explicit approval; Gallery public image records. | Reveal opacity + 12 px Y/550 ms once; no continuous parallax on text. Selected desktop image may move ≤10 px. | Hide a missing pillar; hide mosaic if fewer than 2 usable photos. Never substitute the current hard-coded 19-item list for empty data. |
| Stay/accommodation detail | A single compact split image + key room type or 2-card mini-grid, linked to Accommodation. | Published accommodation records, media and only confirmed capacity/amenities. | Reveal 18 px/550 ms; image hover zoom 1.03/280 ms. | Merge into package details or hide when no complete published option. No empty section heading or generic placeholder image. |
| Food | One wide approved meal photo + 2–4 actual dish/category names; no open accordions. | Published menu items/categories and approved food media. | Fade + 12 px/450 ms, no stagger needed. | Hide completely if no approved menu/image pair. No inferred menu or dietary promise. |
| Photo/story proof | 3–5 image editorial strip/grid with captions and alt text; two stories max. No autoplay. | Gallery public media; published Stories only; submission-backed stories must have `APPROVED` and `consentPublish`. | Image hover zoom 1.03/280 ms; reveal 12 px/500 ms. No auto-advancing carousel. | Hide gallery/story sub-block independently when empty. No testimonial or user imagery without approval and consent. |
| Location strip | Compact location label, confirmed travel guidance if provided, real map/location image or external Maps link. | Settings business address/phone and client-provided travel notes; current coordinates need confirmation. | No parallax. Optional 12 px reveal/450 ms. | Show confirmed address only. No decorative fake map presented as a real map; omit travel-time/distance claims. |
| Final enquiry | Forest/cream close with one clear “Plan your stay” CTA; secondary call/WhatsApp only when configured. | `/book`; Settings contact destinations. | 12 px reveal/450 ms; buttons 180 ms color/press state. | Keep primary link. Remove unavailable contact options without leaving gaps. |
| Global header/CTA/footer | Current sticky navigation; mobile bottom CTA with Call / WhatsApp / Enquire according to configured values. | Public settings and routes. | Existing 180–280 ms color/underline only; no route animation. | Never render empty phone/WhatsApp actions; reserve safe-area and hide bar while fields are focused. |

## Mobile plan (390 × 844 and smaller)

- Keep one-column reading flow, an early stay-choice block, and large 44 px minimum actions. Avoid horizontal carousels for core package information.
- Hero photo crop must keep subject and text area separate; use a strong bottom gradient and no parallax. Put primary CTA above the fold where composition allows.
- Use short copy, three experience pillars, 2–3 stacked package cards, and a horizontally scrollable proof strip only for secondary imagery with visible affordance.
- Keep sticky “Enquire” persistent; offer Call/WhatsApp only when present. Check it does not cover bottom content, form controls, or browser safe-area.
- Reduce long distance between sections; collapse secondary descriptive content into destination pages, not nested accordions on Home.
- Respect reduced motion and save-data: static image, no parallax, no autoplay video, immediate content.

## Client assets and facts still needed

- Original high-resolution farm, stay, meal, activity, landscape and people photos; focal points and mobile crops; usage rights and written consent for identifiable people/minors (PRD D-14).
- Which activities are live, safe, available, seasonal, extra-cost, partner-operated, or draft; explicit decision on rafting, jungle trail, fishing, bullock cart and other old-site items (D-6).
- Confirmed current package names, rates, inclusions, valid dates, group minimums, children/infants pricing, taxes and seasonality (D-3/4/16).
- Current accommodation options, inventory/capacity, room/tent features and check-in/out (D-5).
- Approved menu and dietary scope, plus prices for extras (D-18).
- Exact address, correct map pin, approach roads and verified travel guidance from Mumbai/Pune; do not infer drive time (D-13/14).
- Confirmed enquiry phone, WhatsApp number/message and response expectations.
- Whether any real guest stories/reviews can be published, with source, date and permissions (D-19).
- Final cancellation, payment, ID, safety and policy wording (D-1/2/15).
- Active reward values/rules and publish-video consent before any Home reward claim (D-8/9).


