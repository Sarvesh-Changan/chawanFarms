export const GALLERY_CATEGORIES = [
  "Farm",
  "Stay",
  "Food",
  "Activities",
  "Nature",
  "Birds",
  "Night sky",
  "Guests",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];
