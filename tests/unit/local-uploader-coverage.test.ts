import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The test only reads fixed repository-relative source paths.
// eslint-disable-next-line security/detect-non-literal-fs-filename
const read = (path: string) => readFileSync(path, "utf8");

describe("local uploader coverage", () => {
  it("uses local image uploaders in every admin image-bearing editor", () => {
    for (const path of [
      "src/components/admin/cms/CmsContentEditor.tsx",
      "src/components/admin/cms/MediaReferenceField.tsx",
      "src/components/admin/cms/MediaGalleryField.tsx",
      "src/components/admin/cms/SettingsEditor.tsx",
      "src/components/admin/cms/SeoMetadataPanel.tsx",
      "src/components/admin/stories/StoryEditor.tsx",
    ]) expect(read(path)).toContain("LocalImageUploader");
  });

  it("uses the local video uploader for story videos and has no picker", () => {
    expect(read("src/components/admin/stories/StoryEditor.tsx")).toContain("LocalVideoUploader");
    expect(read("src/components/admin/cms/CmsContentEditor.tsx")).not.toContain("MediaPicker");
  });
});
