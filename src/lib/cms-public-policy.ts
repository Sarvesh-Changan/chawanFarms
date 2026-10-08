import type { CmsContentType } from "@/config/cms-content";

export function publicCmsWhere(type: CmsContentType, now: Date) {
  const published = { status: "PUBLISHED" as const, deletedAt: null };
  switch (type) {
    case "testimonial": return { ...published, consentConfirmed: true };
    case "gallery-item": return { ...published, media: { origin: "ADMIN" as const, isPublic: true, deletedAt: null } };
    case "offer": return { ...published, startsAt: { lte: now }, endsAt: { gte: now } };
    case "post": return { ...published, OR: [{ publishAt: null }, { publishAt: { lte: now } }] };
    case "menu-item": return { ...published, isPublished: true, category: { status: "PUBLISHED" as const, deletedAt: null } };
    case "faq": return { ...published, isPublished: true };
    default: return published;
  }
}

export function isScheduledTimeReached(value: Date | null, now: Date): boolean {
  return value !== null && value.getTime() <= now.getTime();
}
