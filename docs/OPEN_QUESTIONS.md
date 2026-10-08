# Open Questions and Client Decisions

Status: all questions below remain open unless the client records a written answer in this file. No application behavior, public content, price, policy, capacity or contact detail should be guessed from an unanswered question.

“Blocks phase” means the first phase in `BUILD_GUIDE.md` that cannot be completed safely without the answer. Some decisions also affect later phases.

## Existing decisions D-1 to D-19

| ID | Question requiring a client answer | Evidence/why it matters | Blocks phase |
|---|---|---|---|
| D-1 | Is v1 offline-payment only (bank transfer/cheque/UPI), or is online payment required? If a gateway is needed later, which one? | The PDF describes bank details on request, 100% payment and cheque realisation; PRD excludes online payment but the database includes gateway-ready fields. | Phase 10 — Booking, pricing & availability |
| D-2 | What is the final cancellation, refund and postponement policy? Which of the two slide-28 statements controls: no refund/cancellation/postponement after confirmation and payment, or a 25% charge when cancelled seven days before check-in? | The PDF contains both statements. No automatic refund calculation is safe until one policy is approved. | Phase 10 — Booking; Phase 7 — Policies |
| D-3 | Are prices GST-inclusive, GST-exclusive, or not subject to GST? Is GST displayed separately? | No GST treatment appears in the PDF, while booking totals have a tax field. | Phase 10 — Pricing |
| D-4 | Does “minimum group of 10” apply only to Part B Guest House, or also to Part A, Part C, picnic or another product? | The minimum appears only on the Part B slide; Part C separately says 30–50. | Phase 10 — Pricing |
| D-5 | What is the operational inventory/capacity: tents, dormitory beds, Guest House rooms, maximum guests, one-day picnic capacity and Camp Organiser lawn capacity? Is availability measured in units or guests? | The PDF gives two Guest House rooms and a Part C group range, but not complete inventory. The schema leaves capacity semantics open. | Phase 10 — Availability |
| D-6 | Which old-website items are still offered: jungle safari/night safari, Jain food, egg package, cottage, dairy/poultry visits, boating/backwaters, group activities, climbing activities, fish farming and rafting? If rafting is offered, is it own or partner-operated? | These are historical website claims and are absent or different in the PDF. PDF-supported jungle trail/rafting must still be distinguished from “jungle safari”. | Phase 7 — CMS content; Phase 9 — Public website |
| D-7 | Which languages launch: English only, or English plus Marathi and/or Hindi? Which content must be translated by launch? | PRD says English at launch and i18n-ready; database uses locale JSON. | Phase 2 — Design/UI; Phase 7 — CMS |
| D-8 | What are the reward values and rules: points per approved video, lifetime cap, submission cap/period, minimum redemption, tiers, discount limits, expiry, eligible products, stacking, manual-adjustment caps, and negative-balance behavior after reversal? | The PDF contains no reward values. Security requires all values to be server-side and configurable. | Phase 11 — Rewards engine |
| D-9 | What are the video rules: maximum file size, duration, accepted formats, ownership/minor consent wording, visit verification, moderation rules and separate public-reuse consent? | Security gives example formats/caps but says to confirm them; the PDF gives no video-upload rules. | Phase 6 — Media; Phase 12 — Video submission/moderation |
| D-10 | Is the referral programme enabled in v1? If yes, what is the separate rule set and eligibility? | PRD makes referrals optional and disabled by default; the database has only a basic Referral model. | Phase 11 — Rewards |
| D-11 | Which notification channels are required: email only, WhatsApp Business API, SMS, or a manual WhatsApp click-to-chat flow? Who receives admin alerts? | PRD requires email and WhatsApp-share behavior, but the PDF supplies no email/WhatsApp number and SMS has Indian DLT/cost implications. | Phase 14 — Notifications/jobs; Phase 8 — Lead forms |
| D-12 | Is Google/social login required? | PRD places it at P2; architecture leaves it as an auth choice. | Phase 4 — Authentication |
| D-13 | Who owns the domain/DNS, business email, Google Business Profile, current analytics and the canonical current phone/contact list? What is the current WhatsApp number? | PDF lists three phone numbers and no email/WhatsApp; the archived website lists different older numbers and emails. | Phase 8 — Lead forms; Phase 15 — SEO; Phase 20 — Deployment |
| D-14 | Are original photos/videos available, and do the client and identifiable people grant marketing rights? Should a new shoot be commissioned? | PDF collages are low-resolution; public media needs rights and consent. | Phase 2 — Design/UI; Phase 6 — Media; Phase 9 — Public website |
| D-15 | Who approves the privacy policy, terms, cancellation/stay rules, safety disclaimer, marketing consent and video/minor consent language? | Security requires legal review and policy-version capture; client reviewer is unspecified. | Phase 7 — CMS policies; Phase 20 — Deployment |
| D-16 | What are seasonal/peak dates and rate-validity dates? Does Part C “valid for one month” refer to a calendar month, a rolling month or a one-time offer? | The PDF gives “valid for one month” but no dates. Rates must be versioned and date-selectable. | Phase 10 — Pricing |
| D-17 | Which staff exist, what roles do they need, who approves videos and who may adjust/reverse points? Who is the second approver? | The database defines role types but no people or separation-of-duties assignments. | Phase 5 — Authorization/admin shell |
| D-18 | What are the prices and calculation rules for mutton/chicken per kg, fish/shellfish, barbecue and bullock cart? What does “extra” include? | The PDF names extras but gives no amounts, units beyond per kg for meat, or serving rules. | Phase 10 — Pricing; Phase 7 — CMS |
| D-19 | Are there real testimonials/reviews with explicit permission to publish? | The PDF contains no testimonials. The archived website contains template/dummy text that must not be reused. | Phase 7 — CMS; Phase 9 — Public website |

## New questions found during analysis

| ID | Question requiring a client answer | Evidence/why it matters | Blocks phase |
|---|---|---|---|
| D-20 | Approve a canonical PDF transcription and a source-slide map. Should editorial corrections be displayed, and should original typo text be retained only in audit metadata? | Appendix A has wrong slide references for multiple sections, and the PDF contains source typos. | Phase 0 — Requirements/content analysis; Phase 7 — CMS |
| D-21 | Approve or correct source copy/labels: “times slows down”, “Kareoke”, “Idli Sabar”, “Omlet”, “Egg Burji/Burgee”, “Barb-E-Que”, “Safety Major”, “Dinning”, “Mutton/Mutto[n]”, and the Marathi text as rendered. | These are visible PDF spellings/grammar issues. Silent correction changes client content. | Phase 7 — CMS content |
| D-22 | For one-day picnic, is ₹1100 for both veg and non-veg, and does “Non-Veg Meal (chicken)” mean chicken is the only non-veg option? Are adult/kid rules the only child rules? | Slide 28 gives two age prices but does not separate veg/non-veg prices. | Phase 10 — Pricing |
| D-23 | Does Part C include lunch? Is the “Lunch / Dinner Menu” a menu reference only, or an included meal? Does “one night stay” apply to the organiser’s own tents? | Slide 26 inclusion sentence omits lunch while the menu heading mentions it. | Phase 10 — Pricing/availability |
| D-24 | What is the start/end date and renewal behavior for the Part C one-month validity? | A rate with no date anchor cannot be selected reliably by a pricing engine. | Phase 10 — Pricing |
| D-25 | Is white-water rafting operated by Chawan Farms or a third party? What location, operator, safety requirements, age limits, weather cancellation and liability language apply? | The PDF lists rafting as optional, but no operator or safety detail is supplied. | Phase 7 — CMS; Phase 10 — Booking; Phase 20 — Legal/deployment |
| D-26 | Are image-only inferences such as spiders/insects/nature observation, river access, and specific facilities intended as publishable offerings, or are they only photographs? | Several slides contain photographs without text. Images are not sufficient proof of a bookable facility/activity. | Phase 7 — CMS |
| D-27 | Is the archived website content still current, and should any historical page/URL be redirected or preserved? | The live origin could not be reached during analysis; archived captures are from 2018 and contain stale/template content. | Phase 0 — Analysis; Phase 15 — SEO |
| D-28 | May an unregistered/unauthenticated visitor submit a guided booking request, or is verified email required before a Booking record is created? | PRD/BUILD_GUIDE describe public booking and a create-account prompt; SECURITY requires verification before booking-linked actions. | Phase 4 — Authentication; Phase 10 — Booking |
| D-29 | What is the booking-request hold policy: do holds block inventory, how long do they last, and do anonymous requests receive holds? | Architecture mentions soft holds and an example expiry but no approved value; hold-flooding is a security risk. | Phase 10 — Availability |
| D-30 | What exact records are required for a booking price adjustment, and may confirmed bookings ever be repriced? | PRD requires immutable snapshots plus an adjustment record, but DATABASE has no adjustment model. | Phase 3 — Database; Phase 10 — Booking |
| D-31 | Should a PolicyVersion have draft/published status and separate keys for stay rules, cancellation, privacy and terms? | DATABASE defaults `publishedAt` and cannot represent the seed plan’s D-2-pending draft cleanly. | Phase 3 — Database; Phase 7 — Policies |
| D-32 | Which PDF/archived-site photographs may be reused, who owns them, and are identifiable guests/minors consented? | The PDF contains many people/guest photographs and the archived site contains additional imagery. | Phase 2 — Design; Phase 6 — Media |
| D-33 | What is the canonical address spelling, PIN/postal code, map pin and directions link? | The PDF gives Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra, India but no PIN or coordinates. | Phase 7 — Settings; Phase 9 — Public website; Phase 15 — SEO |
| D-34 | Is the 4–10 child band inclusive at both ends, and is the 60% rule applied to every package and picnic price? | “Below 4” and “from 4 to 10” imply boundaries, but pricing needs explicit inclusive behavior. | Phase 10 — Pricing |
| D-35 | Does the Guest House “2 self-contained AC rooms” mean a maximum of two bookable rooms, and can a group of 10 share/occupy them under one package? | The physical room count and the Part B minimum-group wording need an operational mapping. | Phase 10 — Availability |
| D-36 | Does “100% payment to confirm” override the PRD’s `PARTIALLY_PAID` booking status, and which offline payment methods are accepted in v1? | PDF says 100% payment and cheque realisation; PRD/database also model partial payment and UPI/cash. | Phase 10 — Booking/payments |
| D-37 | Should old website email/contact information be permanently rejected, or is any of it still owned/current? | Archived contact page lists different phone numbers, emails and a contact person than the PDF. | Phase 8 — Leads; Phase 15 — SEO |
| D-38 | **Resolved 2026-10-08:** use dedicated, ordered `GalleryItem` entries linked to `Media`, not Media category/tag ordering. Keep categories in `src/config/gallery.ts`; create `MediaUsage` rows for deletion protection. | Client decision in implementation request. | Resolved for Phase 3 — Database and Phase 7 — CMS |
| D-39 | Is revision history required at launch, and how long should unpublished revisions be retained? | PRD marks revisions P1 but the schema has no revision models or retention rule. | Phase 7 — CMS |
| D-40 | What is the account export/deletion workflow, approval SLA and legal retention exception for bookings, payments, points and audit records? | PRD/SECURITY require export/delete, while DATABASE has no request/workflow model. | Phase 3 — Database; Phase 13 — Customer dashboard |

## Decision recording rule

When the client answers a question, record the date, respondent/role, exact decision and any exceptions below the row or in an ADR. A decision is not considered resolved because an implementation assumption was made. Until recorded, keep the affected content nullable/draft and block the listed phase.

### Provisional implementation parameters (2026-10-07)

These values were supplied for implementation, are **provisional**, and do not resolve D-7 or D-9. Reconfirm them with the client before production use.

- D-7 locales: `en` required; `mr` and `hi` optional. Default locale: `en`.
- D-9 `customer_video`: `mp4`, `mov`, `webm`; maximum 100 MB; maximum duration 90 seconds.
- Admin media: images `jpg`, `png`, `webp`, `avif`; maximum 10 MB. Videos `mp4`, `webm`; maximum 100 MB; maximum duration 120 seconds. Admin video use is in scope for hero loops and brand film.
- Customer videos should receive eager H.264/MP4 and first-frame JPEG poster transformations. These limits and transformations are centralized in `src/config/media.ts` pending client confirmation.
