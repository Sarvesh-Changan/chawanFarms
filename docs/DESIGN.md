# DESIGN — Chawan Farms Visual & UX System

> Goal: an editorial, immersive, **farm-first** identity — rural Maharashtra, agriculture, adventure, authentic food, family time, eco-tourism. It must **not** look like a generic hotel/resort template (no stock infinity pools, no gold-on-black luxury cues, no carousel-of-room-photos hero).

## 1. Brand idea
**"Where time slows down."** (derived from the client's own slide: "Imagine a place where time slows down"). Supporting lines from the PDF may be reused verbatim ("Come live, experience & rediscover yourself & nature at its best"). New taglines must be marked *suggested* and approved by the client.

Personality: warm, grounded, curious, unhurried, a little playful. Voice: first-person-plural, plain English, short sentences; sprinkle Marathi words with meaning (e.g. *bhakri*, *misal*, *kolad*) where authentic. Never exaggerate (no unverifiable "best", "luxury", "award-winning").

## 2. Visual language
- **Texture over gloss**: laterite-red soil, paddy/leaf greens, woven fibre, hand-painted bullock-cart wheel, tin plates (thali) — reflected as subtle grain, torn-paper/organic edges, hand-drawn line icons (leaf, sickle, cart wheel, tent, star).
- **Editorial layouts**: asymmetric grids, oversized serif headlines, pull-quotes, captions in small caps, overlapping image masks (arch / leaf / hill silhouette shapes — Sahyadri skyline as a recurring divider).
- **Photography-led**: large, honest, warm photos of real farm life; people in candid moments (with consent). PDF images are low-res collages — **request originals / commission a shoot (D-14)**. Until then use placeholder frames and never upscale-blur.
- **Video storytelling**: 6–8 s muted loops (mist over hills, tilling, chai pour, bullock cart, star trails), plus one 45–60 s brand film opened in a lightbox on user action.

## 3. Colour tokens (CSS variables; light + dark-friendly)

Starting palette (adjustable after client review; the PDF's teal/red is a PowerPoint theme, not a mandated brand).

| Token | Hex | Use |
|---|---|---|
| `--forest-900` | `#12301F` | primary dark, footer, hero overlay |
| `--forest-700` | `#1F4D33` | primary brand, headings on light |
| `--leaf-500` | `#4E8F3A` | accents, success |
| `--paddy-300` | `#B7C96B` | highlights, tags |
| `--laterite-600` | `#B4482A` | CTA secondary, earthy accent (soil red) |
| `--turmeric-500` | `#E9A21B` | primary CTA / reward / marigold accent |
| `--cream-50` | `#FBF6EA` | page background |
| `--clay-100` | `#F1E4CF` | cards/sections |
| `--ink-900` | `#1B1B18` | body text |
| `--mist-500` | `#6B7A72` | secondary text |
| `--night-900` | `#0C1620` | star-gazing / night sections |

Rules: body text contrast ≥ 4.5:1, large text ≥ 3:1, focus ring ≥ 3:1 against adjacent colours; CTA buttons use `turmeric` on dark or `forest-700` on light; never rely on colour alone for state. Verify with a contrast checker before sign-off.

## 4. Typography
- Display: a characterful serif (e.g. **Fraunces** or **Playfair Display**) — variable, optical size, used for H1–H3 and pull-quotes.
- Text/UI: **Inter** or **DM Sans**.
- Devanagari (Marathi/Hindi, incl. "कृषी पर्यटन केंद्र"): **Noto Serif Devanagari** (display) / **Mukta** or Noto Sans Devanagari (text). Load via `next/font` with subsets; use `font-display: swap`, size-adjust fallbacks.
- Scale (fluid, `clamp`): H1 40→84px, H2 30→56, H3 22→32, body 16–18 (min 16 on mobile), small 14. Line-height 1.5–1.7 body, 1.05–1.15 display. Max measure ~65ch.

## 5. Layout & spacing
Mobile-first; breakpoints 360 / 640 / 768 / 1024 / 1280 / 1536. 12-col grid desktop, 4-col mobile; 8-pt spacing scale; generous vertical rhythm (section padding 72–140px desktop, 48–72 mobile). Touch targets ≥ 44×44 px. Safe-area insets respected on sticky bars.

## 6. Components (build as reusable, documented in `components/ui` + `marketing`)

- **Sticky mobile CTA bar**: [Call] [WhatsApp] [Enquire/Book] — appears after hero scroll, hides while keyboard is open, never covers form inputs, respects safe-area. Desktop: sticky header "Book / Enquire" button + floating WhatsApp bubble.
- **Hero**: full-bleed poster + looped video (lazy, reduced-motion → static), headline, 2 CTAs ("Plan your stay", "Chat on WhatsApp"), subtle scroll cue. Hero LCP image `priority`.
- **Experience cards**: tall image cards with hover/tap reveal and "Enquire" micro-CTA.
- **Package card / comparison**: Tent & Dormitory · Guest House · Camp Organiser · One-day Picnic — price **from CMS** (display "from ₹X per person" only if rate exists), inclusions checklist, conditions note (e.g. min group), Veg/Non-veg toggle.
- **Accommodation showcase**: image slider with captions, amenity icons, capacity (only if known).
- **Food section**: horizontal scroll "thali" story, veg/non-veg filter, menu accordion, "extra charge" tags, no invented dishes.
- **Activities**: icon + photo tiles; "Subject to conditions & availability" badge; "extra cost" tag for bullock cart.
- **Gallery**: masonry, category chips (Farm, Stay, Food, Activities, Nature, Birds, Night sky, Guests), lightbox with swipe/keyboard/ESC, video tiles, deep-linkable.
- **Customer stories / reviews**: real, moderated; video story cards (only with publish consent).
- **Rewards teaser**: "Share your farm story → earn points → enjoy savings on your next visit" with 3-step graphic, **no numbers unless pulled from live rule settings**; legal fine print link.
- **Location**: static styled map (privacy-friendly) + "Open in Google Maps" + travel notes (client to provide; do not invent distances).
- **Booking stepper**: 5 steps max on mobile, autosave, inline validation, live *estimate* panel with "final price confirmed by team" note, clear policy summary and checkbox.
- **Account dashboard**: points ring + ledger timeline, coupon "tickets", upload card with progress/resume, status chips (Pending/Approved/Rejected with reason).
- **Admin UI**: dense but calm; left nav by module; data tables with filters/saved views; slide-over editors; draft/publish badges; keyboard-friendly; mobile-usable for approvals (video queue with swipe approve/reject **plus confirm**).
- **Empty / loading / error states** designed for every list; skeletons not spinners for content; friendly error pages.

## 7. Page blueprints (public)

1. **Home** — Hero → Why Chawan Farms (3 pillars: Real farm · Stay close to nature · Food from the farm kitchen* ) → Experiences → Accommodation → Packages → Food → Activities → Gallery → Stories → Rewards → Location → CTA. (*Phrase claims only if client confirms.)
2. **About** — story, farm philosophy (rural-life awareness & agri-science education from PDF), family/team (client photos), values.
3. **Experiences** — editorial grid; detail pages with long-form story + gallery + related package CTA.
4. **Activities** — grouped (Farm · Water · Trails · Evenings · Games), conditions note.
5. **Accommodation** — Tent/Dormitory, Guest House (2 AC rooms with terrace), Camp lawn.
6. **Packages** — comparison + detail; camp-organiser quote form; school/educational group enquiry.
7. **Food** — Maharashtrian menu, veg/non-veg, breakfast list, extras.
8. **Gallery**, **Stories**, **Offers**, **FAQs** (accordion + FAQ schema), **Contact**, **Book/Enquire**, **Login/Sign up**, **Rewards how-it-works**, **Policies**.

## 8. Motion & interaction principles
- Purpose-first: motion guides attention, shows hierarchy, confirms action. Nothing blocks content.
- Allowed: fade/translate-in on scroll (once), parallax on hero imagery (transform only, small amplitude), image-mask reveals, cursor-free hover lifts, number/progress animations in dashboard, gentle marquee for logos/stories (pausable), page transitions via View Transitions where supported.
- Technique: CSS transforms/opacity only; IntersectionObserver or CSS scroll-driven animations; `motion` library lazy-loaded per component; no scroll-jacking; no autoplaying audio.
- Durations 150–400 ms (UI), ≤ 700 ms (section reveals); easing `cubic-bezier(.22,.61,.36,1)`.
- **`prefers-reduced-motion`**: disable parallax/auto-play/transform reveals; show static poster.
- Respect `Save-Data` and slow connections: no video, smaller images.
- Performance guardrails: CLS 0 on animated elements (reserve space), no animation of layout properties, max one heavy scroll effect per viewport, test on low-end Android.

## 9. Imagery & media guidelines
- Cloudinary delivery: `f_auto,q_auto`, `c_fill` with focal gravity; art-directed crops for mobile vs desktop; LQIP/blur placeholders.
- Aspect ratios: hero 16:9 + 4:5 mobile; cards 4:5; gallery mixed; OG 1200×630.
- Alt text meaningful & localised; decorative images `alt=""`.
- Faces: only with permission; avoid identifiable minors in marketing unless guardian consent on file.
- Video: H.264/H.265 + VP9/AV1 fallbacks via Cloudinary, captions where speech.

## 10. Accessibility (WCAG 2.2 AA)
Semantic landmarks & heading order; skip link; visible focus; full keyboard support (lightbox, stepper, menus, calendar); ARIA only where needed; form labels, error summaries, `aria-live` for async results; date picker accessible with typed input fallback; no hover-only content; captions/transcripts for brand video; zoom to 200%; tested with axe + manual screen-reader pass (NVDA/VoiceOver/TalkBack).

## 11. Performance budget (public pages)
LCP ≤ 2.5 s (4G mid-range Android), INP ≤ 200 ms, CLS ≤ 0.1; initial JS ≤ ~150 KB gz; hero image ≤ 150 KB mobile; hero video ≤ ~2 MB, lazy; total page weight ≤ ~1.5 MB initial; fonts ≤ 2 families, subsetted; lighthouse mobile ≥ 90 on Home/Packages/Contact.

## 12. Content & microcopy rules
- CTAs: "Plan your stay", "Get a quote", "Chat on WhatsApp", "Call the farm", "Share your story", "Redeem points".
- Price display: only admin-managed values; format `₹1,400` (en-IN); show "per person, per night, incl. meals" exactly as client states; show conditions (min group, child 60%, under-4 free) near price.
- Policy honesty: surface key rules (no outside food/alcohol, no pets, ID at check-in, cancellation) before submit.
- Safety tone: "You are visiting a working agricultural farm…" (client's safety notice, reworded only with approval).

## 13. Deliverables from the design phase
Figma (or equivalent) with: tokens, type scale, component library, mobile + desktop for Home, Packages, Package detail, Booking stepper, Gallery, Login/Signup, Account dashboard, Upload flow, Admin dashboard, Video review queue, Lead detail. Client sign-off required before Phase 9 (public build).
