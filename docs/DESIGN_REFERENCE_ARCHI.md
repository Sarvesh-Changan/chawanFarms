# Archi Green study → Chawan Farms adaptation brief

This is a design study, not a visual copy. The reference was captured from the home page and the first five same-site header/footer destinations at 1440×900 and 390×844 touch viewports. Screenshots and videos are local-only; no reference assets are reused. The raw evidence is in `docs/reference/archigreen/` and the capture method is `scripts/reference/capture.ts`.

## What the study found

Archi Green is an image-led architecture portfolio with a dark, cinematic first impression. The home page uses an immersive full-bleed hero, a very large condensed display headline, a thin top rule, sparse navigation and a high-contrast pill CTA. Content then alternates between dark and pale surfaces, using short editorial blocks, oversized section titles, numbered proof points, image cards, a services carousel, project filters, testimonials and a final statement.

The measured desktop type system is Jost for display headings and Montserrat for body/UI. Representative computed values were H1 83.52px/83.52px, H2 64.8px/64.8px, H3 48px/52.8px, body 18px/27px, with a 16px/25.6px body baseline. The reference’s measured colors are recorded in `tokens.json` for understanding only; they are not Chawan Farms tokens.

The hero uses a dark image overlay to protect white copy. The desktop header places three primary links in the center, a white rounded “get in touch” action at right and a circular menu control. Mobile reduces the header to logo plus menu and moves the primary actions into the hero. The site’s data identified WordPress/Elementor, GSAP, ScrollTrigger, SplitText, ScrollSmoother, Swiper and jQuery from DOM/script evidence.

The services carousel is Swiper-based rather than CSS scroll-snap. Desktop exposes roughly two 489px slides in a 990px carousel viewport; mobile exposes one 350px slide. The carousel has duplicate slides, arrows and swipe support; no autoplay attribute was detected. The sampled motion included GSAP/ScrollTrigger-related transforms, a 0.475 desktop movement rate for one large section image and 0.861 on mobile, plus mostly normal document flow. Counter samples were stable during the three-second probes (250, 2.5, 50, 100 and item numbers); they should therefore not be treated as proven animated counters.

The capture had two honest limits: the reference did not reach network-idle consistently, and its hidden/off-canvas Elementor DOM copies prevented several requested element screenshots from resolving. The full-page/viewport screenshots, videos, linked-page screenshots, interaction attempts and JSON measurements remain valid evidence; the missing section shots are listed in `report.md`.

## Adaptation principles for Chawan Farms

Keep the editorial pacing and the confidence of the reference, but change the emotional center from “premium architecture portfolio” to “working farm, shared time and rural discovery.” Use the approved Chawan Farms starting palette and type choices from `docs/DESIGN.md`: Fraunces or Playfair Display for display, Inter or DM Sans for UI/body, and Noto Serif Devanagari or Mukta for Marathi/Hindi. Do not use the reference’s Jost/Montserrat pairing or sampled colors as brand tokens.

- Use a warm, honest farm photograph or a muted 6–8 second loop in the hero. Keep a static poster fallback and no autoplaying audio. Use `forest-900` overlay, cream copy and `turmeric-500`/`forest-700` CTAs from the existing system.
- Preserve the reference’s `// Section`-style eyebrow rhythm as a Chawan convention such as `// Farm life`, `// Stay close to nature`, or `// What the day feels like`; do not copy its wording. The existing `SectionHeading` is the right abstraction to extend.
- Adapt numbered proof points into three client-approved pillars: Real farm, Stay close to nature, and Food from the farm kitchen. Keep the numbers as navigation/order cues, not unverified claims.
- Replace architectural project metadata with small chips/tags such as `Farm`, `Stay`, `Food`, `Nature`, `Birds`, `Night sky`, and `Guests`. Chips must remain text-labelled so color is never the only state signal.
- Use image cards with a gentle dark gradient and a small hover scale, but keep captions and enquiry actions visible on touch. Do not use luxury-resort stock photography or exact reference card treatments.
- Keep CTA shapes quiet and large enough for touch: `Plan your stay`, `Get a quote`, `Chat on WhatsApp`, `Call the farm`, `Share your story`. Use a filled turmeric action on dark surfaces and forest on light surfaces.
- Use a service-style carousel only where the content genuinely benefits from sequence: accommodation, food stories or a small set of farm experiences. On mobile show one card with a visible next control and a swipe hint; on desktop show a partial next card. Provide a non-carousel grid fallback when JavaScript is unavailable.
- Use the reference’s closing-statement energy for a calm final CTA, but use the approved “Imagine a place where time slows down” direction from the client materials only where approved. Suggested new copy remains unapproved until client sign-off.

## Motion specification

| Element | Trigger | Effect / distance | Duration | Easing | Stagger | Parallax rate | Reduced-motion fallback | Performance notes |
|---|---|---:|---:|---|---:|---:|---|---|
| Hero image | Page load / scroll | Static poster; optional small transform only | ≤700ms reveal | `cubic-bezier(.22,.61,.36,1)` | 0 | 0.9–1.0 | Static image, no video | Reserve aspect ratio; prioritize LCP image |
| Hero copy | Page load | Opacity + 12–20px upward reveal | 400–600ms | Chawan easing | 80ms between eyebrow/title/body | 1 | Visible immediately | Transform/opacity only |
| Section heading | First viewport entry | Opacity + 16px upward reveal once | 400–600ms | Chawan easing | 0 | 1 | No transform; visible | IntersectionObserver; do not block content |
| Numbered pillars | Entry | Opacity + 12px upward reveal | 350–500ms | Chawan easing | 80ms siblings | 1 | Static list | Keep layout reserved to avoid CLS |
| Experience/card image | Hover/focus/tap | `scale(1.03)` plus gradient change | 250–350ms | ease-out | 0 | 1 | No scale | Avoid animating layout or filter-heavy effects |
| Carousel slide | Button/swipe | Translate to next slide | 300–450ms | ease-out | 0 | 1 | Instant/keyboard-accessible change | Lazy-load only adjacent media; pause when offscreen |
| Gallery lightbox | Open/close | Opacity + small scale | 200–300ms | ease-out | 0 | 1 | Instant open/close | Trap focus and support Escape/swipe |
| Reward steps | Entry | Progress line and step opacity | 400–600ms | Chawan easing | 100ms | 1 | Fully visible steps | No reward values unless live settings exist |
| Dashboard counter | Enters viewport | Numeric interpolation only when meaningful | 600–900ms | ease-out | 80ms | 1 | Final value shown | Use live server values; avoid decorative counting |
| Closing CTA | Entry | Opacity + 20px upward reveal | ≤700ms | Chawan easing | 0 | 1 | Static | Keep CTA reachable without animation |

Use `prefers-reduced-motion: reduce` to disable parallax, autoplay, transform reveals and counter interpolation. The existing motion guidance in `docs/DESIGN.md` is the source of truth for implementation constraints.

## Reference-to-Chawan section map

| Reference pattern | Chawan Farms section | Existing component / proposed component | Adaptation |
|---|---|---|---|
| Overlay header and sparse nav | Global header | `src/components/marketing/Header.tsx`, `PublicNavigation.tsx` | Keep the current navbar structure exactly: Home, Explore, Stay, Gallery, Rewards, Contact. Preserve sticky booking/contact access and add an accessible mobile menu state. |
| Full-bleed hero | Home hero | `Hero.tsx`, `HomeSections.tsx`, `HeroVideo` | Farm-first poster/video, approved client wording, two CTAs, scroll cue, reduced-motion fallback. |
| Large display headline | Home opening statement | `SectionHeading.tsx`, heading tokens | Use Fraunces/Playfair Display and Chawan fluid scale; do not reproduce reference uppercase copy or exact sizing. |
| Numbered proof metrics | Why Chawan Farms | `HomeSections.tsx`, new `PillarList` if needed | Three approved pillars; no invented visitor/project statistics. |
| Services carousel | Experiences / accommodation / food story | `ExperienceCard.tsx`, `AccommodationShowcase.tsx`, new accessible `ContentCarousel` | Prefer grid on mobile or offer a carousel with buttons, labels, keyboard and swipe. |
| Feature block with supporting list | Farm philosophy / activities | `ActivityTile.tsx`, `HomeSections.tsx` | Use real farm, water, trails, evenings and games content from CMS. |
| Dark spotlight band | Rewards teaser or brand film | `RewardsTeaser.tsx`, new `BrandFilmCta` | Use client-approved reward rules and a user-triggered lightbox; no unapproved points. |
| Projects with filter chips | Gallery | `GalleryGrid.tsx`, `GalleryViewer.tsx` | Use approved categories and deep-linkable lightbox; chips remain accessible buttons. |
| Testimonials | Customer stories | `HomeSections.tsx`, new `TestimonialCard` | Publish only moderated, consented real testimonials. |
| Closing statement + CTA | Final booking/enquiry CTA | `FinalCta.tsx`, `StickyCtaBar.tsx` | Calm “time slows down” direction, with book/enquire/call/WhatsApp actions driven by settings. |
| Footer | Contact/location/legal | `Footer.tsx`, `ContactButtons.tsx` | Use approved address, phones, policies and configured WhatsApp only. |

## Data and approval gates

The following blocks must be **hidden until the client provides approved data**:

- Hero photography/video, original farm imagery, people imagery and all identifiable guest/minor photography.
- Published testimonials, customer stories, video stories and any social proof.
- Accommodation inventory, capacity, exact check-in/check-out presentation and availability.
- Package prices, tax treatment, seasonal validity, minimum-group rules and child pricing confirmation.
- Food menu items, serving scope, veg/non-veg wording and all extras pricing.
- Activity availability, safety copy, rafting/operator details, fishing access and bullock-cart pricing.
- Reward values, caps, expiry, eligible packages and explicit consent to publish customer videos.
- WhatsApp number, email address, notification recipients and final contact/social links.
- Location map treatment, travel notes, directions and distance claims.
- Cancellation/refund policy, payment timing, GST wording, ID/safety/legal copy and policy version.
- Any numeric counters or “over X” claims not backed by a live CMS/admin value.

## Risks and safer alternatives

| Risk | Safer alternative |
|---|---|
| Heavy hero video, GSAP or multiple image layers hurt LCP/INP on Indian mobile networks. | Priority responsive poster, lazy muted video only after first paint/interaction, `f_auto,q_auto`, reserved dimensions, and a Save-Data fallback. |
| Full-page scroll effects and parallax can disorient users or waste main-thread time. | One small transform-only effect per viewport; IntersectionObserver reveals; disable all motion under reduced motion. |
| A carousel hides content and is difficult for keyboard/screen-reader users. | Use a grid by default, or provide labelled previous/next buttons, slide count, roving focus, swipe, pause and a “view all” route. |
| Hover-only card content disappears on touch. | Keep title, summary and CTA in the static card; hover is enhancement only. |
| Reference-style dark overlays can reduce text contrast over real farm photos. | Add a measured gradient, verify contrast against the actual crop, and provide a solid fallback surface. |
| Client PDF and old-site content conflict on cancellation, extras and activities. | Keep uncertain content in draft/CMS; show “Contact us” rather than guessing; version policies before publishing. |
| Faces, minors and guest videos create consent/privacy exposure. | Require media consent metadata, moderation, alt text and a separate publish-consent flag. |
| Decorative counters imply proof that Chawan Farms cannot verify. | Render only live admin values, or replace with qualitative pillars. |

## Implementation notes

The current home composition already has `Header`, `HomeSections`, `Footer`, `StickyCtaBar`, `SectionHeading`, `ExperienceCard`, `AccommodationShowcase`, `GalleryGrid`, `RewardsTeaser`, `Reveal` and `ParallaxImage` building blocks. The next design pass should refine those components and the CMS content shape rather than introduce a reference-site clone or a new navigation model.

The capture artifacts are intentionally local-only for media: `docs/reference/**/*.png` and `docs/reference/**/*.webm` are ignored. The scripts, JSON measurements and markdown analysis are the reviewable study record.
