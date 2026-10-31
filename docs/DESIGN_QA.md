# Superseded by the admin simplification on 2026-10-27. Retained as a historical QA record.

# Design QA record


## Content provenance

- No Archi Green text, images, logo, testimonials, colours, or other reference assets are imported or reused. The reference material remains a local design study only.
- Home and inner-page copy uses existing Chawan Farms CMS content, Settings, the approved PDF wording, or existing client-approved interface labels. The new closing fallback is the approved PDF wording: “Come live, experience & rediscover yourself & nature at its best”.
- Testimonials remain server-filtered to published records with `consentConfirmed = true`; no testimonial fixture is present in production components.
- Statistics render only from the CMS stats section, and the rewards teaser shows numeric values only from an active database reward rule.
- Prices continue to come from package rates and the existing `formatINR`/catalogue mapping; no pricing, capacity, amenity, contact, award, or certification values were added.

## Interaction and motion audit

- New and existing public reveals use opacity and transform only; layout dimensions are reserved by aspect-ratio/fill media containers.
- Reduced motion removes reveal, parallax/zoom, smooth scrolling, and the closing background effect. Carousel changes remain instant and keyboard reachable.
- No autoplay carousel or autoplay audio was added. Story and experience sliders use scroll snap, labelled controls, pagination, and arrow/Home/End keyboard support.
- Filter tabs retain roving tabindex/`aria-pressed`; gallery tabs, dropdown navigation, and the mobile menu remain user-controlled.
- Focus styles remain visible on links, buttons, tabs, pagination, carousel regions, and lightbox controls.

## Verification

The repository test suite and jest-axe checks are the executable accessibility baseline. A manual screen-reader/TalkBack pass, a real throttled Android run, and Lighthouse measurements remain release QA tasks because the required browser runner/content environment was unavailable in this workspace.

