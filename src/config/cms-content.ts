export const CMS_CONTENT_PAGE_SIZE = 20;
export const CMS_PREVIEW_TTL_SECONDS = 5 * 60;
export const CMS_SCHEDULE_BATCH_SIZE = 100;

export const CMS_CONTENT_TYPES = [
  "activity",
  "experience",
  "menu-category",
  "menu-item",
  "faq",
  "offer",
  "testimonial",
  "gallery-item",
  "post",
  "post-category",
] as const;

export type CmsContentType = (typeof CMS_CONTENT_TYPES)[number];

export const CMS_CONTENT_ACTION_PERMISSIONS = {
  list: "cms.read",
  preview: "cms.read",
  save: "cms.write",
  restore: "cms.write",
  reorder: "cms.write",
  publish: "cms.publish",
  trash: "cms.delete",
} as const;

export const CMS_CONTENT_ROUTES: Record<CmsContentType, string> = {
  activity: "activities",
  experience: "experiences",
  "menu-category": "menu-categories",
  "menu-item": "menu-items",
  faq: "faqs",
  offer: "offers",
  testimonial: "testimonials",
  "gallery-item": "gallery",
  post: "stories",
  "post-category": "story-categories",
};
