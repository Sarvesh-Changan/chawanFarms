# Decisions

## 2026-10-28 - Local media ownership

- The central admin media library is removed. The former route is retained only as a permanent redirect to `/admin`; no public or admin media browser route exists.
- Media and MediaUsage remain the source of truth, including signed uploads, verification, Cloudinary webhooks, content hashes, where-used checks, delete protection and the `media.*` upload permissions.
- Every image/video-bearing editor owns its upload controls through LocalImageUploader or LocalVideoUploader. Provisional-photo replacement is handled in the owning form via its badge, not a global filter.
- This removes the global overview of unused assets. The weekly media-orphans report mitigates that risk and excludes customer-origin media, VideoSubmission references, and all entity usages; it may only clean expired pending admin uploads.

## 2026-10-27 — Admin simplification step 1

- The `/admin/cms` hub and its route prefix are removed. Canonical editors are `/admin/activities`, `/admin/stories`, `/admin/gallery`, `/admin/menu`, `/admin/faqs`, `/admin/packages`, `/admin/accommodation`, and `/admin/settings/policies`.
- The existing Experience editor remains available at hidden `/admin/experiences-legacy` until the Stories migration in step 3. Public `/experiences` and the Home Experiences block remain live.
- Pages, PageSections, Offer, and Testimonial Prisma models/data are preserved. Page public readers, PageBuilder, Page preview, the Offer admin editor, the public Offers page, and the Home testimonial block are removed.
- Home and About are fixed-code compositions. Settings keys `home.hero.headline`, `home.hero.subhead`, `home.hero.cta`, and `home.closing.headline` override the PDF-backed defaults in `src/config/site-content.ts`.
- Booking `offerId`, coupon eligibility, reward/offer combination rules, Offer services, and their tests are intentionally unchanged.
- `/book?offer=` finding: the former Offers page linked to `/book?offer=<slug>`, but the current booking page accepts only `package` and `activity` query parameters. No Offer-to-booking selection path is implemented by this step; the existing booking and coupon/reward logic remains unchanged.
- Permanent redirects are retained for `/offers` to `/packages` and legacy admin CMS entity URLs to their canonical editors. `/experiences*` is not redirected in this step.
