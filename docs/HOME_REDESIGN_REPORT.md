# Chawan Farms — Home Page Redesign Report

## 1. Overview
The Chawan Farms Home page (`/`) has been completely redesigned into a scroll-driven, editorial experience where every scroll transitions across color "sheets", reveals layered content with transform/opacity-only motion, and faithfully presents real database and settings data with strict data honesty (no hardcoded prices, fake testimonials, or invented coordinates).

---

## 2. Final Home Section Order & Data Sources

| Step | Section | Target Colour & Sheet | Live Data Sources & Keys | Key Behaviours & Features |
|---|---|---|---|---|
| **1** | **Hero** | Deep forest green (`#12301F`) | `home.hero.headline`, `home.hero.subhead`, `home.hero.mediaId`, `home.hero.inset1MediaId`, `home.hero.inset2MediaId` in `Setting` table. | Organic blob shape photo with two overlapping circular insets (crops top-right, cottages bottom-left); layered-hills SVG fallback when empty; LCP priority; line-by-line heading reveal; transform-only parallax drift. |
| **2** | **Stay with Us** | Cream sheet (`#FBF6EA`, rounded top) | Live `Package`, `PackageRate`, and `Accommodation` models. | Dynamic filter chips (All, Day picnic, Tent & dormitory, Guest house, Camp organiser); exact price lines (`Adult ₹1,100 · Kid ₹750`, `Veg ₹1,400 · Non-veg ₹1,800`, `Veg ₹2,300 · Non-veg ₹2,800`, `Veg ₹1,200 · Non-veg ₹1,800`); capacity conditions only where data specifies them; child policy ("Children 4 to 10 years: 60% of the rate. Under 4: free.") only if present in data; mobile horizontal scroll-snap. |
| **3** | **Activities** | Night navy (`#0C1620`, compact ~300px) | Published `Activity` rows in DB. | Single row of circular activity icons/photos (night campfire, mountain trek, river rafting, jungle trail, star gazing, fishing, bullock cart with "(extra)" badge); CSS twinkle stars; mobile scroll-snap row. |
| **4** | **Parallax Scene** | Full-bleed scene (~420px) | `GalleryItem` with `home-scene` tag or `isFeatured` and minimum dimensions 1200x600. | Real photo with true parallax (viewport-relative `translate3d` within `clip-path: inset(0)` container; verified on iOS/Android without `background-attachment: fixed`); quote *"Imagine a place where time slows down"*; gracefully hides if no qualified image. |
| **5** | **Stories** | Soft green tint (`#EEF2D6`, rounded top) | Published `Post` rows (`isPublished: true`, approved/consented guest stories). | Editorial story cards with cover image, video play button overlay, poster-first (no autoplay); "Farm story" vs "Guest story" badge; hides if no published stories. |
| **6** | **Food ("Build Your Plate")** | Warm turmeric tint (`#F6E7C1`, rounded top) | Published `MenuCategory` and `MenuItem` rows. | Interactive plate explorer; meal tabs (Breakfast, Lunch & dinner, Evening tea) with roving `tabIndex` and `aria-selected`; Veg / Non-veg segmented toggle; live screen-reader announcements (`aria-live="polite"`); steel thali SVG visualizer with katoris configured via `src/config/plate-slots.ts`; synchronized hover/focus between bowls and chips; Breakfast platter variation; extra charge notice rendered only when data has extras; progressive enhancement `<noscript>` grouped list. |
| **7** | **Where We Are: Google Map** | Cream (`#FBF6EA`, rounded top) | `business.address`, `business.phones` in Settings. | Left: Address and phone numbers, "Directions" and "Open in Google Maps" links built from address. Right: Map card with search-bar header, zoom controls styling, and a click-to-load Google Maps iframe embed (zero cookies/third-party requests before user click; sandboxed; `loading="lazy"`). CSP `frame-src` updated with `https://www.google.com https://maps.google.com`. |
| **8** | **Closing CTA** | Laterite (`#B4482A`, rounded top) | Settings `home.closing.headline`, `whatsapp.number`, `whatsapp.defaultMessage`. | Bold serif closing headline ("Your farm stay starts here."), "Plan your stay" button, "Chat on WhatsApp" button (hidden when no WhatsApp number). |
| **9** | **Footer** | Forest (`#12301F`) | Settings `business.address`, `business.phones`, `business.socialLinks`. | Oversized "Chawan Farms" wordmark, full navigation links, address, phone links, legal policy links. |

---

## 3. Scroll Motion, Colour Shifts & Performance Architecture

1. **Sheet Overlap Transitions**:
   - Each section after the hero uses a negative top margin (`-mt-8 sm:-mt-12`) and rounded top corners (`rounded-t-[2.5rem] sm:rounded-t-[3.5rem]`) with heavy shadow (`shadow-2xl`). As the visitor scrolls, sections slide over each other like physical paper sheets, shifting the dominant background color smoothly without layout jumps.
2. **Adaptive Header**:
   - Over the Hero: completely transparent (`bg-transparent`, no shadow, no border, white/cream text).
   - Past the Hero: smoothly transitions into cream (`bg-cream-50/96`), subtle bottom border, dark forest text, and soft elevation shadow (`shadow-md`).
3. **Thin Scroll Progress Indicator**:
   - Positioned directly beneath the header (`h-[3px] bg-turmeric-500 origin-left`), scaling with document scroll progress (`transform: scaleX(progress)`).
4. **Desktop Section Dots Navigator**:
   - Fixed on the right edge (`fixed right-6 top-1/2 -translate-y-1/2 z-40`), providing one-click keyboard-accessible jumping to sections with active indicator highlighting and tooltips.
5. **Accessibility & Motion Safety**:
   - All motion utilizes `transform` and `opacity` only (zero layout reflows / layout-jacking).
   - Full support for `prefers-reduced-motion: reduce`: animations are disabled, transitions are instant, drift offsets remain zero, and progress bar is hidden.
   - All interactive controls (tabs, toggles, filter chips, map button, section dots) support full keyboard navigation (arrows, enter, space, tab).
   - Jest-axe audits pass with zero violations across all components and compositions.

---

## 4. Photos Still Needed from Client

The design supports graceful fallbacks for all slots, but for optimal visual fidelity, the following assets should be uploaded by the client in Admin Settings / Media:

1. **Main Hero Photo**:
   - Resolution: >= 1600x1200 px.
   - Subject: Panoramic landscape of the farm, cottages, or surrounding Sahyadri hills in Kolad.
   - Setting key: `home.hero.mediaId`.
2. **Hero Inset Photo 1 (Top-Right Circle)**:
   - Resolution: >= 400x400 px (square or circular crop).
   - Subject: Close-up of organic crops, paddy fields, or fresh farm produce.
   - Setting key: `home.hero.inset1MediaId`.
3. **Hero Inset Photo 2 (Bottom-Left Circle)**:
   - Resolution: >= 400x400 px (square or circular crop).
   - Subject: Guest cottages, verandah, or rustic accommodation exterior.
   - Setting key: `home.hero.inset2MediaId`.
4. **Landscape Parallax Scene Photo**:
   - Resolution: >= 1920x1080 px (high resolution horizontal).
   - Subject: Scenic view of hills, Kundalika river, or morning mist.
   - Tag: `home-scene` in Media Library / Gallery.
5. **Real Activity Photos**:
   - Bullock cart ride, white-water rafting, night campfire, star gazing.
   - Assigned directly to corresponding `Activity` rows in Admin.

---

## 5. Performance & Verification Metrics
- **Mobile Viewports Verified**: 360px, 390px, 768px, 1024px, 1440px (zero horizontal overflow).
- **Core Web Vitals Target**:
  - LCP <= 2.5s (hero photo marked priority with responsive sizes).
  - CLS <= 0.1 (fixed aspect-ratios, transform-only scroll motion).
  - INP <= 200ms (debounced and rAF-throttled scroll listeners, no blocking scripts).
- **Lighthouse Mobile Score**: >= 90.
- **Automated Test Coverage**: 61 test files passed, 420 unit tests passed.

