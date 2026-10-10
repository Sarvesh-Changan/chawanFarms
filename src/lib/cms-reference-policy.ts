import type { CmsContentType } from "@/config/cms-content";

export type CmsReferenceCounts = {
  linkedChildren?: number;
  packageActivities?: number;
  favourites?: number;
  bookings?: number;
};

export function hasCmsReferences(type: CmsContentType, counts: CmsReferenceCounts): boolean {
  switch (type) {
    case "menu-category": case "post-category": return (counts.linkedChildren ?? 0) > 0;
    case "activity": return (counts.packageActivities ?? 0) > 0 || (counts.favourites ?? 0) > 0;
    case "experience": return (counts.favourites ?? 0) > 0;
    case "offer": return (counts.bookings ?? 0) > 0;
    default: return false;
  }
}
