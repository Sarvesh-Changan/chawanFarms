# Superseded by the admin simplification on 2026-10-27. Retained as a historical QA record.

# Admin → public-site manual QA checklist


Use only the DEV environment and a DEV/test database. Use a private browser window for the anonymous visitor. Prefix every created value with `QA-<timestamp>`. Do not send real email; use console/in-memory transport. Run against a production build (`npm run build`, `npm start`) first, then repeat the key checks in dev mode. Record the time from the admin success message to the first anonymous page that shows the new value.

## Setup

- [ ] Confirm the browser URL is the DEV site and the database is not production.
- [ ] Open one admin session and one logged-out/private visitor session.
- [ ] Open browser console and Network panels. Record any console error, hydration warning, CSP error, or failed image request.
- [ ] Use desktop width 1440px and phone emulation width 390px.
- [ ] Keep the QA marker, created record IDs, media public IDs, and cleanup result for the report.

## A. Images and media

1. **Upload:** open `/admin/media`, choose a valid JPG, PNG, and WebP one at a time, and confirm progress, success, Media row, thumbnail, QA category/tag and English alt text. Verify the Cloudinary DEV Admin API asset exists and its delivery URL returns 200 with an image content type and `f_auto`/`q_auto` transforms.
2. **Invalid upload:** try an oversized file, `.txt`, `.exe` renamed to `.jpg`, an SVG, and the same file twice. Confirm clear errors, no Media row for rejected files, and no Cloudinary orphan.
3. **Public assignment:** assign the QA image in the page builder Home hero, an Experience, Accommodation, Package, Activity, Post cover, SEO OG image and Gallery item. Publish each owner and check Home, each list/detail page, related blocks, metadata/OG, JSON-LD and sitemap where applicable. Check alt text, focal crop, no broken image, no CSP/console error, and hero priority.
4. **Replacement:** replace one assigned image with a second QA image. Save/publish and check every prior location without a hard reload or redeploy; record the delay and confirm the old URL is absent.
5. **In-use delete:** select the image while it is assigned and soft-delete it. Confirm the UI explains where it is used and blocks deletion. Remove the usage, delete again, confirm it disappears from the library and Cloudinary, and verify no public broken reference.
6. **Draft privacy:** attach media to a draft/unpublished entity. Check anonymous HTML, `view-source`, sitemap and metadata contain neither the draft content nor its private image URL. Confirm only a valid preview token can show it.

## B. Content edits

7. **Packages/rates:** in `/admin/cms/packages`, edit a QA package description and rate. Check `/packages`, package detail, Home stay cards, `/api/quote`, each `/book` step and the `from ₹X` label. Add a newer rate version, confirm the old one is not selected, and verify an empty active rate says “Contact us for rates”. Check en-IN formatting.
8. **Catalogue/content workflow:** for Accommodation, Activity, Experience, Menu item, FAQ, Offer, Testimonial, Post/Story, Page/Section, and Gallery item: create QA record, save draft, edit, reorder where available, publish, unpublish, schedule, trash and restore. After every transition check every location in `ADMIN_TO_SITE_MAP.md`. Advance the DEV clock or use a short schedule; never change production time.
9. **Settings:** in `/admin/settings`, change QA phone, WhatsApp, address, social link and business name if the field exists. Check header, footer, sticky CTA, Contact page, JSON-LD, call and WhatsApp links. Clear WhatsApp and a social link and confirm the corresponding controls disappear everywhere.
10. **Policies:** publish a QA policy version in `/admin/cms/policies`. Check `/policies`, `/privacy`, `/terms`; create a new DEV booking and verify its policy version; confirm an existing booking still has its original snapshot.
11. **SEO:** edit title, description, canonical, robots, OG image and JSON-LD in the SEO panel. Check rendered metadata and `view-source` on the target page, OG image URL, canonical, robots directives and sitemap inclusion/exclusion.
12. **Availability:** block a QA date in `/admin/availability`; confirm `/api/availability` and the `/book` date picker show it unavailable. Unblock it and confirm both update immediately.
13. **Preview:** create a draft and use the admin Preview button. Confirm a valid token shows it with noindex, a tampered/expired token shows nothing, and anonymous non-token routes never expose the draft.
14. **Rewards:** activate a QA reward rule and check `/rewards` and the account dashboard use only the active rule. Deactivate it and confirm numbers disappear. Check the provisional banner in admin.
15. **Gallery:** add a QA Gallery item, reorder it, change category, publish/unpublish, then delete it. Check `/gallery`, Home teaser, filters and lightbox after each action; verify Home hides the teaser when empty.

## C. Cross-cutting evidence

16. For each action record HTTP status, console/hydration/CSP errors, canonical URL, JSON-LD validity, sitemap result, desktop 1440px and phone 390px result, reload result, and the audit-log entry at `/admin/security/audit`.
17. Log in as a restricted Reservations-style role. Confirm CMS/media edit controls are hidden and direct server actions/API calls return a rejected result.
18. In two admin sessions edit the same QA record concurrently. Confirm there is no silent lost update; a conflict or clear last-write rule must be visible, and the public result must be consistent.
19. Measure save/publish-to-anonymous visibility for every entity. Flag anything over 5 seconds, requiring a manual refresh/redeploy, or differing by route.

## Cleanup

- [ ] Unpublish QA content, remove media usages, delete/restore-check then delete QA records, and verify they are absent from public pages, sitemap and source.
- [ ] Delete every QA Cloudinary asset from the DEV account and confirm no QA-folder/tag asset remains.
- [ ] Remove QA bookings/leads/settings/policy fixtures using the approved DEV cleanup path; do not delete pre-existing records.
- [ ] Confirm audit records remain as evidence and list any intentional residue.
- [ ] Re-run `/`, `/sitemap.xml`, `/gallery`, `/packages`, `/stories`, `/book`, and `/api/health` anonymously after cleanup.

