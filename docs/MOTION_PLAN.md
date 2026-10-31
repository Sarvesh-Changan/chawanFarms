# Site motion plan

This proposes one site-wide motion language based on source inspection and the 1 November 2026 DEV browser capture. It is a plan only; no application code was changed.

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

The repository has CSS entrance animations for hero lines/copy, experiences, nature mosaics, stay cards, guest stories and closing CTA, plus Motion-powered `Reveal` and `ParallaxImage`, hero scroll parallax, CountUp, hover/focus transforms and scroll-snapping carousel interactions. Existing tokens use 180/280/550/700/800 ms. This is broader than needed and no route-transition pattern was found. On captured Home desktop, `hero-line-in`, `hero-copy-in`, `bounce`, `nature-mosaic-in` and `stay-card-in` were observed; utility transition durations included 150, 200 and 280 ms. The hero copy entered from 18 px above and settled. No continuous scroll parallax was observed on Home. Home's hero media was absent, so its background parallax effect was not active; touch/mobile Home was static. Runtime samples are in `docs/qa/ui-audit/metrics.json`.

Home-specific observed-in-source note: `HeroBackground` is the only active parallax candidate in current Home JSX. `ParallaxImage` is used on design showcases, not the Home route. `Reveal` is not currently mounted by Home section components. The Home gallery and final CTA do not render, so their associated styles are not active in the current Home composition.

## Where parallax is realistic today

The Home hero could use subtle parallax only after Settings contains a high-resolution approved photograph with safe crop space and a sufficiently opaque text gradient. In the captured DEV state no hero photo was configured, so there is currently no suitable Home parallax image. Gallery assets need content correction and crop review before considering a small desktop-only effect. Do not apply parallax to the abstract location fallback, cards with small crops, text, or customer/child imagery without consent.

## Audit follow-up

The DEV route/viewport browser pass and Home scroll recordings are complete. Authenticated account behavior was not available without DEV customer credentials. A dedicated reduced-motion browser pass was not performed; reduced-motion behavior remains source-verified only. Do not treat source support as runtime verification.
