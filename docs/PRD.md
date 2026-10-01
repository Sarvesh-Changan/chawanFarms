# PRD — Chawan Farms Agri-Tourism Platform

> Status: v1.0 draft for client review · Primary content source: client PDF `CHAWAN_FARM_PRESENTATION_01_10_2026.pdf` · Reference only: https://www.chawanfarms.com/

## 1. Purpose

Rebuild the Chawan Farms website from an informational brochure into a **lead-generation, enquiry/booking and customer-rewards platform** for an agri-tourism centre at Baitwadi, Kolad, Tal. Roha, Dist. Raigad, Maharashtra, India.

### Goals
1. Convert visitors into qualified enquiries/bookings (primary KPI).
2. Present Chawan Farms as an authentic farm-life experience, not a generic resort.
3. Create repeat visits and user-generated content through an **admin-moderated video → reward points → coupon** loop.
4. Let the client manage 100% of content, availability, rates, leads and rewards without a developer.

### Non-goals (v1)
- Online payment collection (the PDF describes bank transfer / cheque; architecture must allow a gateway later).
- Native mobile apps. Multi-property/multi-tenant support. Channel manager / OTA sync.

## 2. Source-of-truth rules (apply to every contributor, human or AI)

1. **The PDF wins** over the old website and over this document's examples. If they conflict, flag it in `docs/CONTENT_CONFLICTS.md`; do not silently choose.
2. **Never invent** prices, facilities, policies, capacities, certifications, awards, testimonials, statistics or contact details.
3. Everything the client can change (prices, rules, copy, rates, reward values) lives in the database/CMS, never hardcoded. The seed script may load the PDF values, each tagged with its source slide.
4. Missing information is stored as `null` + shown as "Contact us" — never guessed.
5. Items present on the old website but **absent from the PDF** (e.g. jungle safari, Jain food, cottage naming) are imported as **DRAFT / unpublished** until the client confirms.

## 3. Personas

| Persona | Needs |
|---|---|
| **Family / friends group (Mumbai–Pune urban)** | Weekend stay or one-day picnic, kids' activities, safe food, clear price per person, WhatsApp-first contact |
| **School / educator** | Agri-education visit (PDF: awareness of rural life and agriculture science for urban school children), group quote |
| **Camp organiser** | Lawn for own tents, 30–50 persons, washrooms, dining, campfire, group rate |
| **Corporate / community group** | Group outing, workshops, slide shows |
| **Nature enthusiast** | Birding, star gazing, trekking, jungle/nature trail |
| **Returning guest** | Upload video, earn points, redeem coupon, rebook |
| **Farm owner / manager (admin)** | Approve videos, handle leads, manage rates & availability, no technical skills |
| **Staff (limited admin)** | Handle enquiries/bookings only |

## 4. Sitemap / Information architecture

Public: `/` · `/about` · `/experiences` (+ `/experiences/[slug]`) · `/activities` (+ `[slug]`) · `/accommodation` (+ `[slug]`) · `/packages` (+ `[slug]`) · `/food` · `/gallery` · `/stories` (+ `[slug]`) · `/offers` · `/rewards` (how it works) · `/faqs` · `/contact` · `/book` (enquire/book) · `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/privacy` · `/terms` · `/policies` (stay rules, cancellation) · `/404`.

Customer (`/account/*`): dashboard · profile · bookings & enquiries · points & ledger · coupons · video submissions (+ upload) · favourites · notifications · referrals · privacy (export/delete).

Admin (`/admin/*`): dashboard · CMS · bookings · enquiries · leads · availability/calendar · customers · rewards · media · SEO · settings · security (staff, roles, audit).

Languages: **English at launch**; i18n-ready structure (Marathi/Hindi) — see decision D-7.

### Homepage funnel
Hero (video/photo) → Why Chawan Farms → Experiences → Accommodation → Packages → Food → Activities → Gallery → Customer Stories → Rewards → Location (map) → Booking/Enquiry CTA. Sticky mobile CTA bar (Call · WhatsApp · Enquire) on every public page.

## 5. Functional requirements

Priority: **P0** = launch blocker, **P1** = launch target, **P2** = post-launch.

### 5.1 Public website
- FR-PUB-1 (P0) All pages in §4 CMS-driven, SEO-ready, responsive, accessible (WCAG 2.2 AA target).
- FR-PUB-2 (P0) Package pages show admin-managed rates, inclusions, menu, conditions, "Enquire about this package" CTA.
- FR-PUB-3 (P0) Interactive gallery (filter by category, lightbox, keyboard accessible, lazy-loaded Cloudinary images, video tiles).
- FR-PUB-4 (P1) Offers page with validity dates; active offers selectable in booking.
- FR-PUB-5 (P1) Stories/blog with categories, SEO, share.
- FR-PUB-6 (P0) Contact page: phone numbers (from Settings), address, embedded/static map, contact form, WhatsApp, click-to-call.
- FR-PUB-7 (P1) Favourites/wishlist for experiences, activities, packages (login required; guests prompted to sign up).
- FR-PUB-8 (P1) Approved reviews/testimonials display. Only real, consented testimonials.

### 5.2 Customer accounts
- FR-ACC-1 (P0) Sign up (email + password; email verification), login, logout, forgot/reset password, session management.
- FR-ACC-2 (P0) Profile (name, phone, optional city, marketing consent), account dashboard summary.
- FR-ACC-3 (P0) Booking/enquiry history with status.
- FR-ACC-4 (P0) Reward points balance + full ledger, coupons (active/used/expired), video submissions with status & rejection reason.
- FR-ACC-5 (P1) In-app notifications + email.
- FR-ACC-6 (P1) Data export & account deletion request (privacy).
- Social login (Google) is P2 — decision D-12.

### 5.3 Booking & enquiry
Two entry modes using one engine:
- **Quick enquiry** (name, phone, optional email, message, preferred dates, group size) → Lead + Enquiry.
- **Guided booking request** (stepper): dates → guests (adults / children 4–10 / under 4) → stay type (tent/dormitory, guest house, picnic only, camp-organiser lawn) → food option (veg/non-veg) → activities (optional, "subject to conditions & availability") → extras → coupon → contact details → review → submit.

Rules:
- FR-BK-1 (P0) **Server computes all prices** from admin-managed rates using a versioned pricing engine; client shows an *estimate* only. Result stored as an immutable price snapshot on the booking.
- FR-BK-2 (P0) Status flow: `ENQUIRY → PENDING_CONFIRMATION → CONFIRMED → COMPLETED`; branches `CANCELLED`, `NO_SHOW`, `REJECTED`. Payment status separate: `UNPAID → PARTIALLY_PAID → PAID → REFUNDED` (recorded manually by admin in v1).
- FR-BK-3 (P0) Availability: admin sets inventory per accommodation/day (capacity, blocked dates, minimum group size, seasonal closures). Guided booking checks availability but a booking is **not confirmed** until admin confirms (PDF: confirmed against payment).
- FR-BK-4 (P0) Child pricing, minimum-group rules, one-day picnic, camp-organiser and guest-house packages are data-driven pricing rules (§Appendix A).
- FR-BK-5 (P0) Confirmation email + WhatsApp-share link to guest and admin alert on every request.
- FR-BK-6 (P1) Admin calendar (month/week), drag-free simple edit, manual booking creation (phone bookings).
- FR-BK-7 (P1) Admin records offline payments (bank transfer/cheque/cash/UPI), with reference, date, cleared flag (cheque realisation per PDF).
- FR-BK-8 (P2) Payment gateway adapter (e.g. Razorpay) behind a `PaymentProvider` interface — **not built in v1**, but `Payment` table and interface exist.
- FR-BK-9 (P0) Policy acceptance (stay rules, cancellation) captured with timestamp + policy version on submit.

### 5.4 Lead generation
- FR-LD-1 (P0) Every form creates/updates a `Lead` (dedupe by normalised phone/email) and an `Enquiry`/`Booking` child.
- FR-LD-2 (P0) CTA tracking: WhatsApp click, call click, form submit, package/activity-specific enquiry — stored as `LeadEvent` and sent to analytics.
- FR-LD-3 (P0) Source tracking: UTM params, referrer, landing page, first-touch + last-touch, device class; stored with consent rules (§Security).
- FR-LD-4 (P0) Pipeline: `NEW → CONTACTED → QUALIFIED → CONVERTED → CLOSED` (+ close reason: lost/duplicate/spam/not-interested). Assignment, notes, follow-up date, reminders.
- FR-LD-5 (P0) Filters, search, CSV export (permission-gated, audit-logged).
- FR-LD-6 (P0) Spam protection: Cloudflare Turnstile (or equivalent), honeypot, rate limits, disposable-email heuristics.

### 5.5 Rewards & video system (major feature)
Flow: Login → Upload video → Cloudinary (signed upload) → `PENDING` → Admin review → `APPROVED` / `REJECTED` → (APPROVED only) ledger `EARN` → balance → redeem for coupon → apply on future booking.

Hard rules:
- FR-RW-1 (P0) **Uploading never awards points.** Only an admin approval transaction creates an `EARN` entry.
- FR-RW-2 (P0) Immutable points ledger with types `EARN, REDEEM, ADJUST, EXPIRE, REVERSE`. No UPDATE/DELETE (enforced by DB trigger + code review).
- FR-RW-3 (P0) Prevent duplicates: one reward per submission (DB unique), perceptual/content hash for duplicate-video detection, per-period submission cap, idempotency keys on every ledger write.
- FR-RW-4 (P0) Prevent client manipulation: points, coupon value, eligibility computed server-side only; user-supplied values ignored.
- FR-RW-5 (P0) Manual adjustments: permission-gated, reason mandatory, per-role max, above threshold requires second approver, audit-logged.
- FR-RW-6 (P0) Admin-configurable (never hardcoded): points per approved video; max points per customer; max submissions per period; minimum points to redeem; fixed or percentage discount; max discount; minimum booking value; coupon expiry; eligible packages; eligible accommodation; coupon combination rules; point expiry; manual-adjustment permissions.
- FR-RW-7 (P0) Reward rules are **versioned**; the version in force at approval time is stored on the ledger entry.
- FR-RW-8 (P1) Reversal: if an approved video is later found invalid (copyright, fraud), admin can `REVERSE`; negative balance policy configurable.
- FR-RW-9 (P1) Video submission requirements shown up-front: ownership/consent checkbox, people-in-video & minors guidance, content rules, max size/duration, accepted formats; admin can rate/feature approved videos for the website *only with a separate explicit publishing consent*.
- FR-RW-10 (P1) Referral rewards (optional, same ledger; separate rule set; disabled by default) — decision D-10.

### 5.6 Admin dashboard
Modules and permissions are defined in `DATABASE.md` (RBAC). Dashboard widgets: new leads (today/7d/30d), enquiries & bookings by status, upcoming arrivals, conversion funnel, lead sources, customers, reward activity (points issued/redeemed), pending videos (queue count + oldest age), recent activity (audit feed), revenue/booking metrics (confirmed value, collected, outstanding).

CMS entities: pages, sections, experiences, activities, accommodation, packages & rates, food/menu, gallery, stories, FAQs, testimonials, offers, SEO per entity, global settings. Draft/publish with preview, scheduled publish (P1), revision history (P1), soft delete.

Media: Cloudinary library browser, upload, alt text (required), captions, focal point, categories/tags, video thumbnails, usage tracking (where used) to prevent deleting in-use assets.

SEO: title, meta description, keywords (optional), OG image, canonical, robots, JSON-LD (LocalBusiness/TouristAttraction/LodgingBusiness, FAQPage, Article, Offer), sitemap/robots settings.

Settings: business info, phone numbers, email, address, geo, social, WhatsApp number & default message, booking settings (min lead time, minimum group sizes, check-in/out defaults, policy text), reward settings link, notification settings (recipients, templates), integrations (analytics IDs).

Admin security: staff users, roles, permissions, audit logs (who/what/when/before/after/IP), session list, forced logout, 2FA (P1).

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 on mid-range Android over 4G (primary audience is mobile in India). Initial JS per route budget in DESIGN/ARCHITECTURE. |
| SEO | SSR/ISR for all public pages, structured data, sitemap, Local SEO (Kolad/Raigad/Roha, "agri tourism near Mumbai/Pune" — keyword research is a content task, no guaranteed rankings). |
| Accessibility | WCAG 2.2 AA, keyboard navigable, reduced-motion respected, alt text mandatory. |
| Security | See `SECURITY.md`. |
| Availability | Vercel + Neon managed; target 99.9% app availability; documented backup/restore. |
| Scalability | Stateless app, pooled DB connections, indexes, CDN media; expected load is small — avoid over-engineering. |
| Privacy | India DPDP Act 2023 aligned: notice, consent, purpose limitation, retention, erasure. Legal review by client. |
| Observability | Sentry errors, uptime monitor, structured logs, audit logs. |
| Browser support | Last 2 versions of Chrome, Safari (iOS 16+), Edge, Firefox, Samsung Internet. |
| Maintainability | Typed end-to-end, tests on money/points/auth logic, docs. |

## 7. Additional features added beyond the brief (and why)

| Feature | Why it matters | Priority |
|---|---|---|
| Spam protection (Turnstile + honeypot) | Public forms are spam targets; protects lead quality and email reputation | P0 |
| Rate limiting & brute-force lockout | Required for auth, forms, uploads | P0 |
| Lead dedupe + attribution (UTM/first-touch) | Tells client which channels produce bookings | P0 |
| Availability + blackout dates | Prevents double-promising a small property (2 guest-house rooms) | P0 |
| Policy acceptance snapshot | PDF has strict no-refund/ID/alcohol/pet rules; proof of acceptance reduces disputes | P0 |
| Immutable audit log | Required by client for reward/booking trust; supports staff accountability | P0 |
| Consent & privacy centre | Videos may show minors/other guests; DPDP compliance | P0 |
| Duplicate-video detection | Core anti-fraud for rewards | P0 |
| Notification system (email + in-app, WhatsApp click-to-chat) | Lead response speed drives conversion | P1 |
| Reward expiry & coupon expiry jobs | Configurable requirement; needs scheduled jobs | P1 |
| Referral system (disabled by default) | Cheap customer acquisition; can reuse ledger | P2 |
| Reviews moderation | Social proof with control over authenticity | P1 |
| Scheduled publishing, revisions | Safe content editing by non-developers | P1 |
| 2FA for admin | Admin accounts control rewards and customer data | P1 |
| Error monitoring + uptime | Production reliability | P0 |
| Data export/delete for customers | Legal/privacy | P1 |
| i18n-ready content model | Marathi/Hindi audience; avoids later rewrite | P1 |
| Cookie/analytics consent banner | Required for GA4/ads pixels under privacy norms | P0 |
| Backup/recovery runbook | Neon PITR + media export plan | P0 |

Explicitly **not** added: loyalty tiers, chat bot, OTA integration, multi-language machine translation, native app. Revisit after launch data.

## 8. Success metrics
Enquiry conversion rate (visit → submitted form/WhatsApp/call), lead→booking conversion, lead response time, bookings per month, repeat-booking rate, video submissions approved/month, points redeemed/issued ratio, Core Web Vitals pass rate, admin tasks completed without developer help.

## 9. Open client decisions (must be resolved before related phase)

| ID | Decision | Blocks phase |
|---|---|---|
| D-1 | Online payment in v1, or offline only (bank transfer/cheque/UPI)? Which gateway later? | Booking |
| D-2 | Final cancellation/refund policy — PDF contains conflicting statements (see Appendix B) | Booking, Policies |
| D-3 | GST applicability and whether displayed prices include/exclude tax | Booking |
| D-4 | Does "min. group of 10" apply to Part A tent/dormitory too, or only Part B? | Pricing |
| D-5 | Inventory: number of tents, dormitory beds, guest-house rooms, picnic day capacity, lawn capacity | Availability |
| D-6 | Which old-website items are still offered: jungle safari, Jain food, cottage, dairy/poultry visits, rafting (own or partner?) | CMS content |
| D-7 | Languages at launch (English only? + Marathi/Hindi) | Design/CMS |
| D-8 | Reward values: points per video, redemption tiers, caps, expiry, eligibility | Rewards |
| D-9 | Video rules: max length/size, consent wording, minors, permission to reuse videos on site/social | Video |
| D-10 | Referral programme yes/no | Rewards |
| D-11 | Notification channels: email only, or WhatsApp Business API / SMS (cost, DLT in India)? | Notifications |
| D-12 | Social login (Google)? | Auth |
| D-13 | Domain/DNS ownership, business email, Google Business Profile access, existing analytics | Deployment |
| D-14 | Photo/video assets: PDF images are low-resolution; need originals or a new shoot; rights to people-photos | Design |
| D-15 | Legal copy: privacy policy, terms, safety disclaimer — who reviews? | Launch |
| D-16 | Seasonal pricing/peak dates, rate validity (PDF Part C says valid one month) | Pricing |
| D-17 | Admin staff list and roles; who approves videos; who can adjust points | Admin |
| D-18 | Extras pricing (mutton/chicken per kg, fish, barbecue, bullock cart) — PDF says "extra" with no amount | Pricing |
| D-19 | Real testimonials/reviews available with permission? | CMS |

---

## Appendix A — Client content extracted from the PDF (SOURCE OF TRUTH)

> Slide references are PDF page order. Text was extracted from slides; wording lightly normalised. **Prices are in INR, as written by client.** Anything unclear is flagged ⚠ and also listed in Appendix B.

**Business**: Chawan Farms — Agri-Tourism Centre ("कृषी पर्यटन केंद्र"). Address: Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra, India. Contacts: 9821502956, 9821089375, 9359895322. Website: www.chawanfarms.com. No email address or WhatsApp number is stated in the PDF ⚠ (D-13).

**Taglines/messages (slides 2–4, 9, 18)**: "Come live, experience & rediscover yourself & nature at its best" · "Agri-tourism could create awareness about rural life and knowledge about agriculture science among the urban school children as well as citizens" · "Imagine a place where time slows down" · Agri-tourism as an inexpensive gateway; curiosity about farming industry and lifestyle; restoration of rural culture.

**Farm & nature offering (slides 4–15)**: horticultural farming, dairy, poultry; organic farming; swimming in the river and a small swimming tank; mountain trek; jungle/nature trail; star gazing; slide shows on biodiversity/wildlife documentaries; workshops on interesting, emerging agricultural topics; open dining area; birdwatching; spiders/insects/nature observation; farming experience; bullock cart (photos).

**Accommodation (slides 1,17,23–25)**:
- Camping tents / Dormitory (Part A) — one night stay included.
- Guest House — 2 self-contained AC rooms with terrace (Part B); check-in 10 am, check-out 10 am next day (24 hours).
- Lawn area only for Camp Organisers (Part C): set up own tents + dining area + washroom facility (Indian & Western) + campfire + electricity + service.
- Check-in/out: 24 hours; confirm times at booking confirmation.

**Amenities (slide 22)**: morning & evening tea; breakfast; lunch (veg/non-veg); dinner (veg/non-veg); open dining area; swimming in river & small tank; volleyball, badminton, carrom, cricket, archery etc. with ample outdoor space; karaoke system.

**Packages (per person per day, one night stay) (slides 23–25)**

| Part | Accommodation | Veg | Non-veg | Conditions |
|---|---|---|---|---|
| A | Camping tents / Dormitory | ₹1400 | ₹1800 | Includes breakfast, lunch, evening tea, dinner |
| B | Guest House (2 AC rooms w/ terrace) | ₹2300 | ₹2800 | Includes breakfast, lunch, evening tea, dinner. Note: rates valid for **group of minimum 10 persons** ⚠ (scope unclear) |
| C | Camp Organiser (lawn only) | ₹1200 | ₹1800 | Group size 30–50; rates valid one month; timing 5 pm to 11 am next morning; includes morning breakfast, evening tea + nasta, dinner; organiser brings tents; property damage by campers recovered from organiser ⚠ (menu lists Lunch/Dinner but inclusions list no lunch) |
| One-day picnic | — | Adult ₹1100 / Kid ₹750 | | Includes breakfast & tea, lunch, evening tea; veg / non-veg (chicken) |

**Child pricing**: below 4 years free; 4–10 years charged 60% of the above prices.

**Menus**: *Lunch/Dinner (veg)*: dal, rice, four chapati / three bhakri, 2 vegetables, sweet, pickle, papad, salad. *Lunch/Dinner (non-veg)*: dal, rice, four chapati / three bhakri, chicken/mutton curry, chicken/mutton masala, sweet, pickle, papad, salad. *Breakfast (veg)*: kanda-poha / sweet sheera / upma / misal-pav / idli-sambar. *Breakfast (non-veg adds)*: bread-omelette / egg bhurji. *Part C evening*: tea/coffee + snacks (batata wada / mung bhaji). *Breakfast menu slide*: kanda pohe / upma / shira / bread & butter (4 pieces) (applicable to packages A, B, C); 2-egg omelette & pav (2); 2-egg bhurji & pav (2); zunka bhakri; kanda bhaji; fish/shellfish as per availability & size (extra charges); mutton/chicken prepared as gravy and masala; mutton charged per kg (extra); chicken charged per kg (extra); barbecue facility available (extra). No Jain-food claim appears in the PDF ⚠.

**Optional activities** ("arranged according to prevailing conditions and availability"): night campfire for cold evening; mountain trek; white-water river rafting; jungle trail; slide show on biodiversity/wildlife documentary etc.; star gazing; fishing; bullock cart at extra cost with prior notification; "etc."

**Rules & policies (slides 20–21)**: confirm check-in/out time at booking. Outside food, catering and alcohol/beverages not permitted. Mosquito coil provided; bring repellents. Not responsible for accidents/loss of belongings. Animals & pets not permitted. Management may vacate guests for noise, nuisance, unruly behaviour. Original photo ID mandatory at check-in (driver's licence, passport, photo credit card etc.). No refund/cancellation/postponement for any reason once confirmed & paid. Bank details provided on request. Booking confirmed against 100% payment (cheque: after realisation). 25% charged when booking cancelled seven days before check-in ⚠ (conflicts with "no refund").

**Safety notice**: guests visit an agricultural farm; insects and animals are common; basic first aid available; bring mosquito/insect repellent, painkillers, band-aids.

## Appendix B — Content conflicts / ambiguities to resolve with client
1. **Cancellation**: "No refund, cancellation or postponement… once confirmed & paid" vs "25% charged when booking cancelled seven days before check-in". Store both as versioned policy text *pending* D-2; do not compute refunds automatically.
2. **Payment timing**: "confirmed against 100% payment" — implies full advance; confirm whether partial advances are ever accepted.
3. **Minimum group of 10**: note appears under Part B only.
4. **Part C inclusions**: lists Lunch/Dinner menu but charges text excludes lunch.
5. **Picnic**: "Veg / Non-Veg Meal (chicken)" — confirm whether veg picnic price equals non-veg price.
6. **Extras** (mutton/chicken per kg, fish, BBQ, bullock cart): no amounts given.
7. **Rafting / jungle safari / Jain food / cottage**: appear in user brief/old website; PDF lists white-water rafting and jungle trail but not "jungle safari" or Jain food. Rafting is probably off-site — confirm operator, safety and liability wording.
8. "Safety Major" is probably "Safety Measure" — confirm wording before publishing.
9. PDF images are low-resolution collages; original files needed for premium presentation.
