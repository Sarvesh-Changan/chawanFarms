type MarketingPhoto = {
  publicId?: string;
  kind: string;
  width?: number | null;
  height?: number | null;
  altText?: unknown;
  tags?: readonly string[];
};

export function isPublicImage(media: MarketingPhoto | null | undefined): media is MarketingPhoto {
  return Boolean(media && media.kind === "IMAGE" && media.publicId?.trim());
}

export function isPublicMedia(media: MarketingPhoto | null | undefined): media is MarketingPhoto {
  return Boolean(media && (media.kind === "IMAGE" || media.kind === "VIDEO") && media.publicId?.trim());
}

export function filterPublicGalleryItems<T extends { media: MarketingPhoto | null }>(items: readonly T[]): T[] {
  return items.filter((item) => isPublicMedia(item.media));
}

function englishAlt(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english.trim() : "";
}

const genericAltText = new Set(["photo", "image", "farm photo", "farm image", "placeholder"]);

export function isMarketingPhoto(media: MarketingPhoto | null | undefined, minimumWidth = 1280, minimumHeight = 800): media is MarketingPhoto {
  if (!media || media.kind !== "IMAGE" || !media.width || !media.height) return false;
  if (media.width < minimumWidth || media.height < minimumHeight) return false;
  if (media.tags?.includes("provisional-pdf")) return false;
  const alt = englishAlt(media.altText).toLowerCase();
  return alt.length >= 8 && !genericAltText.has(alt);
}

export function isScenePhoto(media: MarketingPhoto | null | undefined): media is MarketingPhoto {
  return isMarketingPhoto(media, 1920, 1080);
}
