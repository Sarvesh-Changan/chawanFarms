# Site motion plan

## Applied motion system (2026-11-01)

The shared CSS reveal styles now use the same 500 ms fade + 12 px translate with `cubic-bezier(.22,.61,.36,1)` and once-only IntersectionObserver triggers. The new `Reveal` and `Stagger` wrappers keep content visible in server HTML, animate only after hydration, cap stagger delay at two increments (60 ms), and skip movement for reduced-motion and Save-Data. Existing hero reveals use the same easing/distance family. Card/image hover is 220–280 ms and only transforms the card/image. Dropdown and mobile menu open with a short opacity/transform transition. Native document View Transitions are disabled because they can abort with InvalidStateError when a tab becomes hidden; public route navigation stays immediate. No library was added.

`ParallaxScene` uses a sticky viewport layer clipped inside a tall section and an rAF scroll listener attached only while near the viewport. Its rate is `0.12`; it uses `transform` only. The hero image uses the existing `HeroBackground` scroll transform at rate `0.82`, and eligible catalogue detail photos use it at rate `0.72`. Parallax requires sufficient dimensions, non-provisional media, and descriptive alt text; Home scenes also require the `home-scene` curation tag. The Home feature-scene rate and image movement could not be measured because the confirmed DEV data has no eligible tagged photos; the Playwright run recorded no rendered scene or slider. The hero illustration is static. Parallax is disabled for coarse/touch pointers, reduced motion, and Save-Data.

**Not verified:** real-device iOS Safari and Android sticky/clip-path behavior; no physical devices were available in this run. Playwright Chromium mobile emulation is not a substitute for those devices. The script records browser evidence for wide/touch emulation, parallax transforms, reveal states, snap type, reduced motion, menu and header states, and horizontal overflow.

This motion plan was applied as a shared site motion language. Runtime checks and their limits are listed in `docs/UI_IMPROVEMENT_REPORT.md`; raw evidence is in the ignored `docs/qa/ui-audit/after/` directory.

## Motion tokens

| Use | Duration | Easing / distance |
|---|---:|---|
| Button/field state | 160 ms | `cubic-bezier(.22,.61,.36,1)`; color, border, shadow or ≤1 px press feedback |
| Card hover/focus | 220 ms | Same easing; translate Y −3 px and image scale 1.02–1.03; fine pointer hover only |
| Image zoom | 280 ms | Same easing; scale 1.03, clipped within reserved media box |
| Scroll reveal | 500 ms | Same easing; opacity 0→1 and Y 12→0 px, once at 12% visibility; stagger 60 ms, max 3 children |
| Hero copy | 550 ms | Same easing; opacity + Y 16 px; 80 ms stagger between lines/groups |
| Route transition | none by default | Keep navigation immediate; avoid whole-page fades that delay perceived response. If added later, use opacity only, ≤120 ms, cancel safely on navigation and disable for reduced motion. |
| Selected hero/feature parallax | scroll-linked, no tween beyond rAF | Image-only Y range ≤12 px desktop; not applied to copy/layout. No parallax on touch, save-data, reduced-motion, or low-power devices. |
| Counter | ≤800 ms | Count only verified, live numeric data; otherwise render a static number. |

## Rules

- Animate `transform` and `opacity` only. Do not animate height, margin, grid, or other layout properties. Reserve image dimensions before loading so animation does not cause layout shift.
- No scroll-jacking, forced smooth scroll, auto-playing carousels, auto-advancing stories, or audio. Sliders require visible controls, swipe, keyboard support, pause behavior if ever auto-rotating, and a non-slider fallback; recommended Home pattern is a grid.
- Use IntersectionObserver for one-time reveals; disconnect once fired. Limit to one scroll-linked effect in a viewport. Use passive scroll listeners and `requestAnimationFrame`; only update transform values.
- Do not hide content until hydration or an observer fires. Content must remain available if JavaScript is delayed or disabled.
- For reduced motion, remove parallax, smooth scrolling, entrance transforms and counters; render all content immediately and keep opacity at 1. Listen for preference changes where motion continues after mount.
- For touch or Save-Data/low-power devices, use a static hero image and disable parallax and hover-only effects. Preserve clear focus-visible states.
- Do not animate decorative counters unless the values are real CMS-backed values. No count-up for arbitrary marketing figures.

## Existing implementation against the plan

The repository previously had CSS entrance animations, Motion-powered `Reveal` and `ParallaxImage`, hero scroll parallax, CountUp, hover/focus transforms and scroll-snapping carousel interactions. The shared reveal and route transition patterns have since been consolidated and reduced-motion/Save-Data behavior added. The confirmed DEV data has no eligible Home photo, scene or slider, so Home parallax, slider movement and card-image hover could not be measured at runtime. Raw final checks are in `docs/qa/ui-audit/after/motion-verification.json`.

Home-specific observed-in-source note: `HeroBackground` is the only active parallax candidate in current Home JSX. `ParallaxImage` is used on design showcases, not the Home route. `Reveal` is not currently mounted by Home section components. The Home gallery and final CTA do not render, so their associated styles are not active in the current Home composition.

## Where parallax is realistic today

The Home hero could use subtle parallax only after Settings contains a high-resolution approved photograph with safe crop space and a sufficiently opaque text gradient. In the captured DEV state no hero photo was configured, so there is currently no suitable Home parallax image. Gallery assets need content correction and crop review before considering a small desktop-only effect. Do not apply parallax to the abstract location fallback, cards with small crops, text, or customer/child imagery without consent.

## Audit follow-up

The DEV route/viewport browser pass and Home scroll recordings are complete. Authenticated account behavior was not available without DEV customer credentials. Reduced-motion was checked in Playwright Chromium and rendered no hidden reveals or parallax scenes; real iOS Safari and Android remain unverified.

