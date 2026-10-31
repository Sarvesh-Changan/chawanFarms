import { describe, expect, it } from "vitest";

import { filterPublicGalleryItems, isMarketingPhoto, isPublicImage, isPublicMedia, isScenePhoto } from "@/lib/marketing-media";

const approvedPhoto = { publicId: "farm-paddies", kind: "IMAGE", width: 1920, height: 1080, altText: { en: "Farm paddies at sunrise" }, tags: [] };

describe("marketing photo quality gate", () => {
  it("requires a high-resolution non-provisional photo and meaningful alt text", () => {
    expect(isMarketingPhoto(approvedPhoto)).toBe(true);
    expect(isMarketingPhoto({ ...approvedPhoto, width: 640 })).toBe(false);
    expect(isMarketingPhoto({ ...approvedPhoto, tags: ["provisional-pdf"] })).toBe(false);
    expect(isMarketingPhoto({ ...approvedPhoto, altText: { en: "Photo" } })).toBe(false);
  });

  it("allows public CMS images without a private marketing tag", () => {
    const adminImage = { publicId: "uploaded-by-admin", kind: "IMAGE", width: 640, height: 480, altText: null, tags: [] };
    expect(isPublicImage(adminImage)).toBe(true);
    expect(isMarketingPhoto(adminImage)).toBe(false);
    expect(isPublicMedia(adminImage)).toBe(true);
    expect(isPublicImage({ ...adminImage, publicId: "" })).toBe(false);
  });

  it("allows public videos in the gallery and story media without treating them as photos", () => {
    const video = { publicId: "farm-video", kind: "VIDEO", tags: [] };
    expect(isPublicMedia(video)).toBe(true);
    expect(isPublicImage(video)).toBe(false);
  });

  it("does not hide a published gallery upload just because it is not featured", () => {
    const gallery = [
      { id: "featured", isFeatured: true, media: approvedPhoto },
      { id: "regular", isFeatured: false, media: { ...approvedPhoto, tags: [] } },
    ];
    expect(filterPublicGalleryItems(gallery).map((item) => item.id)).toEqual(["featured", "regular"]);
  });

  it("requires a landscape full-bleed image for scenes", () => {
    expect(isScenePhoto(approvedPhoto)).toBe(true);
    expect(isScenePhoto({ ...approvedPhoto, width: 1280, height: 800 })).toBe(false);
  });
});
