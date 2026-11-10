# Settings image upload and display trace

## Finding

The browser evidence in the task was not supplied: the environment and request/log fields were placeholders. I could not establish which live run failed. I traced the checked-in path and confirmed the write/read key names and media shape line up. The form holds the verified media IDs in React Hook Form and includes them in the hero Save payload; the settings service writes the same IDs that the public reader loads. There is no demonstrated key mismatch.

One concrete silent-failure path was present: all Settings sections share one form and one Zod schema, so a validation error anywhere prevents the submit action from running. The form had no invalid-submit handler, which meant clicking “Save hero content” could produce no status message while leaving the old DB values unchanged. A regression test now exercises that path and the editor reports the validation message. A SettingsEditor test also asserts that owner, hero, and both inset IDs are present in the action payload.

This explains a save that never reached the server action, but the user’s actual failing request was not captured, so I cannot claim it was the sole cause of the reported deployment issue. The real DEV upload and database verification remain unrun because the local Neon branch and Cloudinary account cannot be identified as non-production from the available configuration. No request was made to either service.

## Request and persistence chain

1. `LocalImageUploader` requests `/api/upload-signature` with purpose `admin_image`. It displays upload progress, retains a local preview, then calls `/api/upload-confirm` with the returned Cloudinary public ID and optional English alt text. A confirmed `mediaId` is sent to the parent form.
2. `/api/upload-signature` requires same-origin POST, an authenticated active staff account and `media.write`. `createUploadSignature` uses the admin image preset, server API credentials, and the configured `CLOUDINARY_FOLDER_MODE`; only signed parameters and the public API key are returned.
3. The browser posts the file and signature to Cloudinary. It does not receive the API secret. Cloudinary’s preset and signed upload parameters constrain file types, delivery type, identity and folder.
4. `/api/upload-confirm` checks same origin and staff permission, derives the user and purpose from the public ID, asks Cloudinary’s API for the exact asset metadata, and validates resource type, delivery type, format, size, identity and folder. A valid upload is recorded as a private pending Media row with a 24-hour expiry and uploader ID.
5. On Save, the Settings form submits `ownerMediaId`, `heroMediaId`, `heroInset1MediaId` and `heroInset2MediaId` alongside the settings fields. The strict Zod schema accepts UUIDs (and empty/null values for removal); it does not strip those IDs. Each section’s Save button submits the entire shared Settings form, not just that section.
6. `saveCmsSettings` persists the IDs to `owner.mediaId`, `home.hero.mediaId`, `home.hero.inset1MediaId` and `home.hero.inset2MediaId`; it marks selected admin images public, clears pending metadata, replaces the four `MediaUsage` links, verifies the rows after the transaction, then marks replaced assets deleted only when no usages remain. The prior implementation permits an empty alt text for these Settings uploads. This is intentionally left unchanged because a safe, separate alt-text contract was not established by the reported failure; general public media editing does require English alt text.
7. The server action calls `updateTag("cms:settings")`, matching the public settings reader’s cache tag, and revalidates `/`, `/about`, `/packages`, `/book` and `/contact`, plus `/admin/settings`. `updateTag` is valid in this Server Action on the installed Next.js 16 version and expires the data immediately for read-your-own-writes.
8. `getPublicSettings` reads those same media-ID keys and filters Media by `origin=ADMIN`, `isPublic=true`, and `deletedAt=null`. It projects `publicId`, kind, dimensions and alt text. Its broad catch returns default content if the DB query fails, which can make an infrastructure/read error look like an unset image; it does not log the exception, so deployment logs currently cannot distinguish those cases.
9. `HomeSections` passes `settings.home.hero.media` to `HomeHero`. `HomeHero` accepts a public image and `CldImage` builds an HTTPS URL on `res.cloudinary.com`; `next.config.ts` permits that host. With no main image, it renders the decorative hills SVG fallback. Current checked-in fallback contains no “CROPS & TREES” or “FARM COTTAGES” text; those visible labels are not present in the marketing components searched in this checkout.

### Shape comparison

| Setting | Save key | Public read key | Public media filter |
| --- | --- | --- | --- |
| Hero | `home.hero.mediaId` | `home.hero.mediaId` | Admin image, public, not deleted |
| Inset 1 | `home.hero.inset1MediaId` | `home.hero.inset1MediaId` | Admin image, public, not deleted |
| Inset 2 | `home.hero.inset2MediaId` | `home.hero.inset2MediaId` | Admin image, public, not deleted |
| Owner | `owner.mediaId` | `owner.mediaId` | Admin image, public, not deleted |

The DB key values are strings containing Media UUIDs. The corresponding Media row stores the Cloudinary public ID and metadata. The admin reader also looks up Media by UUID and returns the same public ID used to render the thumbnail. No write/read key mismatch was found.

## Implemented safeguards

- Settings validation failures now produce a visible status message rather than silently skipping the server action.
- While an image upload is in progress, Settings Save buttons remain disabled. The editor warns before a browser-level navigation while image selections/removals are unsaved.
- When refreshed server props contain the just-saved Media row, the uploader drops its transient local preview and displays the DB-backed thumbnail.
- Settings includes a “View on site” link.
- Production and Preview startup now require the Cloudinary server cloud name, API key/secret, admin image upload preset, explicit folder mode, and matching public cloud name. This is validation only; it does not print configured values.
- A read-only DB diagnostic script reports key/value shapes, Media status fields and usage counts; it refuses to run without `APP_ENV=development` and an explicit development flag.

## Reproduction and verification status

The saved browser request/response, Vercel logs, and affected deployment were not available. The `.env.local` database URL points to a Neon host, but the branch was not identifiable as DEV. I did not run the diagnostic script, app server, Playwright login/upload, Cloudinary upload, or public-image HTTP request. The production build completed while its database URLs were overridden to an unreachable localhost endpoint; static generation logged expected database connection errors and continued. This verifies compilation and build output, but not live database-backed rendering. There is no verified DEV image asset or screenshot to report.

After pointing `.env.local` at a confirmed development database and a DEV Cloudinary account, run:

```powershell
$env:APP_ENV = "development"
npm run db:diagnose-settings-images -- --i-know-this-is-dev
npm run build
npm start
```

Then use a seeded Super Admin to upload one small JPG into the hero and each inset/owner field, save, reload Settings, and check that the thumbnail remains. Check Home’s HTML for the Cloudinary image host and request that image URL directly; expect HTTP 200 and `image/*`. Repeat replace and remove. Inspect browser Network and Console without copying or sharing the signed upload request values.

## Vercel settings

Set these values for both Production and Preview, using the appropriate Cloudinary DEV/PROD account credentials and its matching preset per environment:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET` (server-only)
- `CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE`
- `CLOUDINARY_FOLDER_MODE` (`dynamic` or `fixed`, matching the Cloudinary account/preset setup)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (must equal `CLOUDINARY_CLOUD_NAME`)

`SMTP_*` is not used by the image upload path. Redeploy after changing `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, because Next.js embeds public environment values at build time. Do not send secrets or signed URLs in a support message.

## After deploy checklist

1. Confirm the deployed environment has the six Cloudinary values above and that the two cloud names match; redeploy after public-variable changes.
2. Sign in as an authorized staff user on the deployed environment, select a small test image and wait for “Photo uploaded and verified.”
3. Save and confirm the hero Save action reports success. Reload `/admin/settings`; the thumbnail should be loaded from the saved Media row.
4. Open Home and confirm the real photo is shown. In DevTools Network, its Cloudinary image request should return HTTP 200 with an image content type. Check console/CSP for errors.
5. Repeat with both insets and Owner portrait. Replace an image and verify the new one; remove it and confirm the fallback/section behavior.
