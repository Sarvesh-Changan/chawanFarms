# Superseded by the admin simplification on 2026-10-27. Retained as a historical QA record.

# Admin → public-site propagation map


QA scope: DEV only. This map is based on the source trace completed on 27 October 2026. The public readers in `src/server/services/public-content.ts` use `unstable_cache` with a 300-second fallback and CMS tags; public route modules are mostly `force-dynamic`, so a request still depends on those reader caches. This document records coverage; it is not evidence that every path has passed an authenticated browser test.

## Shared propagation rules

- Generic CMS content (`src/server/actions/cms-content.ts`) invalidates `cms:<type>` and `cms:all`, and refreshes the relevant admin list. This covers the matching public reader tag, but does not explicitly revalidate a public path.
- Packages and accommodations (`src/server/actions/cms.ts`) invalidate collection and slug tags. Package detail also reads accommodation/activity data and carries those tags.
- Page Builder invalidates `cms:pages`, `cms:page:<slug>`, the page path (`/` for `home`), and `/admin/cms/pages`.
- Settings invalidates `cms:settings` and explicitly revalidates `/`, `/about`, `/packages`, `/book`, and `/contact`.
- Policy publishing invalidates `cms:policies` and `/policies`, `/privacy`, `/terms`.
- SEO editing invalidates the global SEO tag and the entity SEO tag. SEO is read by `generateMetadata` and JSON-LD consumers.
- Media detail editing and soft-delete currently revalidate only `/admin/media`. Public media is nested inside cached CMS readers, so media-only changes have a stale-content risk until the reader cache expires or the owning entity is saved/published.
- `/sitemap.xml` is generated from the public package, accommodation, activity, experience and story readers and is itself revalidated for 5 minutes. It does not enumerate every CMS page or every static public route.

## Entity coverage

| Admin-editable entity / screen | Save, publish, delete invalidation | Public pages/components and secondary consumers | Metadata, sitemap, JSON-LD, API | Risk/status to verify |
|---|---|---|---|---|
| Home/About page and sections — `/admin/cms/pages` | `cms:pages`, `cms:page:<slug>`, `cms:all`; `/<slug>` (`/` for Home); admin page | `/`, `/about`; page section renderer; shared navigation/footer where page data is used | Page SEO panel; page metadata; page section JSON-LD where configured; not listed in sitemap | Tag/path coverage is present. Verify hide/reorder/image changes on both page and Home teaser locations. |
| Packages and rates — `/admin/cms/packages` | `cms:packages`, old/new `cms:package:<slug>`; admin package list/detail; rates use package collection and slug tags | `/packages`, `/packages/[slug]`, Home package cards, package enquiry form; booking stepper and `/api/quote` read pricing services | Package `generateMetadata`, canonical/robots/OG/JSON-LD; package slug in sitemap | Quote is force-dynamic; verify current active rate selection and old rate exclusion. |
| Accommodation — `/admin/cms/accommodations` | `cms:accommodations`, old/new `cms:accommodation:<slug>`; admin list/detail | `/accommodation`, `/accommodation/[slug]`, Home accommodation cards, package detail related accommodation | Accommodation metadata and JSON-LD; slug in sitemap | Package detail carries accommodation tags. Verify media replacement and published/draft filtering. |
| Experiences — `/admin/cms/experience` | Generic `cms:experience`, `cms:all`; admin list/detail | `/experiences`, `/experiences/[slug]`, Home experiences/spotlight sections | Detail metadata and JSON-LD; slug in sitemap | Verify hero media, body, publish/unpublish and related Home card. |
| Activities — `/admin/cms/activity` | Generic `cms:activity`, `cms:all`; admin list/detail | `/activities`, `/activities/[slug]`, Home activities, package detail activities | Detail metadata and JSON-LD; slug in sitemap; booking/quote relation | Verify extra-cost and prior-notice flags, badges, and package related block. |
| Menu categories/items — `/admin/cms/menu-category`, `/admin/cms/menu-item` | `cms:menu-category` or `cms:menu-item`, `cms:all`; admin list/detail | `/food`, Home food section; menu item category, veg/non-veg and extra-charge labels | No sitemap entry; page metadata/JSON-LD must be checked from rendered HTML | Food reader uses both tags. Verify category/item publish and reorder. |
| FAQs — `/admin/cms/faq` | `cms:faq`, `cms:all`; admin list/detail | `/faqs`; grouped FAQ list | FAQ JSON-LD on `/faqs`; no sitemap entry | Verify group, answer, publish/unpublish and JSON-LD matches visible questions. |
| Offers — `/admin/cms/offer` | `cms:offer`, `cms:all`; admin list/detail | `/offers` | No sitemap entry; page metadata/JSON-LD must be checked | Reader filters start/end dates at request time but is cached; verify before/after validity windows. |
| Testimonials — `/admin/cms/testimonial` | `cms:testimonial`, `cms:all`; admin list/detail | Home testimonials section | No sitemap entry; no separate public detail route | Public reader requires `PUBLISHED` and `consentConfirmed`; verify consent gate. |
| Gallery items — `/admin/cms/gallery-item` | `cms:gallery-item`, `cms:all`; admin list/detail/reorder | `/gallery`, Home gallery teaser, category filters/lightbox | No sitemap entry; gallery page metadata must be checked | Reader additionally requires public ADMIN media. Verify reorder/unpublish/delete. |
| Posts/stories and categories — `/admin/cms/post`, `/admin/cms/post-category` | Generic `cms:post`/`cms:post-category`, `cms:all`; admin list/detail | `/stories`, `/stories/[slug]`, Home stories teaser; category label | Story detail metadata/OG/JSON-LD; story slug in sitemap | Reader filters `publishAt <= now`; verify scheduled content and category edit. |
| Business settings — `/admin/settings` | `cms:settings`; `/`, `/about`, `/packages`, `/book`, `/contact` | Header/footer, sticky contact buttons, Contact page, phone/address/social/WhatsApp consumers | Organization/contact JSON-LD where present; no sitemap effect | Public reader currently exposes phones, address, social links and WhatsApp. “Business name” is not part of this reader and needs a client decision if expected to be editable. |
| Policies — `/admin/cms/policies` | `cms:policies`; `/policies`, `/privacy`, `/terms` | Public policy pages; booking policy snapshot | No sitemap entry; booking service stores the selected policy version | Verify a new booking receives the new version and an old booking retains its snapshot. |
| SEO metadata — `/admin/seo` and per-entity SEO panels | Global `cms:seo` plus `cms:seo:<type>:<id>` | All entity detail metadata consumers | `<title>`, description, canonical, robots, OG image and configured JSON-LD; sitemap inclusion is controlled by public entity status, not SEO alone | Verify entity page and `view-source`, not only hydrated DOM. Media-only OG changes share the media cache risk. |
| Media — `/admin/media` and upload controls | Upload confirmation creates Media/usage records; update/delete revalidates only `/admin/media` | Every page using a selected public ADMIN image: hero, gallery, page sections, cards, testimonials, story cover and OG image | Cloudinary delivery from `CldImage` uses auto format/quality and width transforms; no direct sitemap entry | High stale-content risk for alt text, focal point, public flag, replace/delete. Verify Cloudinary Admin API, HTTP 200 and no orphan. |
| Availability/blackouts — `/admin/availability` | Admin path only; availability reads are force-dynamic | `/api/availability`, booking date picker and booking stepper | No sitemap/metadata effect | Verify block and unblock immediately, including mobile booking UI. |
| Reward rule — `/admin/rewards/rules` | `rewards:rule`, `cms:reward-rule`; `/rewards`, `/account`; admin rules | `/rewards`, account dashboard/reward numbers | No sitemap entry | Verify only the active rule is public and provisional-banner state is correct. |

## Public route inventory

Primary anonymous routes checked by the QA suite: `/`, `/about`, `/accommodation`, `/activities`, `/experiences`, `/food`, `/faqs`, `/gallery`, `/offers`, `/packages`, `/rewards`, `/stories`, `/contact`, `/policies`, `/privacy`, `/terms`, `/location`, `/book`, and `/sitemap.xml`. Dynamic detail routes are added from sitemap or an explicit QA fixture when authenticated propagation tests run.

## Media URL trace

`src/components/media/CldImage.tsx` builds Cloudinary URLs with `f_auto`, `q_auto`, focal-point positioning when supplied, and width-aware Next image loader transforms. Public readers only resolve media where `origin = ADMIN`, `isPublic = true`, and `deletedAt IS NULL`. Draft/unpublished entities and private/customer media should therefore not appear in public HTML or public URLs; this is explicitly covered in the manual checklist.

## Evidence boundary

The source map is complete enough to plan coverage, but authenticated admin actions, audit-log assertions, Cloudinary Admin API verification, concurrency, policy snapshots, and every entity’s propagation delay require explicit DEV QA credentials and fixture records. They must remain `Not verified` until those checks are actually run.

