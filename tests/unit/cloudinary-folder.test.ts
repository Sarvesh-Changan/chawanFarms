import { describe, expect, it } from "vitest";

import { normalizeCloudinaryFolder, verifyCloudinaryFolderBinding } from "../../src/server/integrations/cloudinary";

const expectedFolder = "admin/media/images/staff";
const expectedPublicId = `${expectedFolder}/asset`;

describe("Cloudinary folder verification", () => {
  it.each([
    ["site/", "site"],
    ["/site", "site"],
    ["site", "site"],
    ["site//", "site"],
  ])("normalizes %s", (input, output) => {
    expect(normalizeCloudinaryFolder(input)).toBe(output);
  });

  it("preserves case and rejects empty folders", () => {
    expect(normalizeCloudinaryFolder("SITE")).not.toBe(normalizeCloudinaryFolder("site"));
    expect(normalizeCloudinaryFolder(" / / ")).toBeNull();
    expect(normalizeCloudinaryFolder("")).toBeNull();
  });

  it("accepts the dynamic representation with cosmetic slash differences", () => {
    expect(verifyCloudinaryFolderBinding({
      mode: "dynamic",
      expectedFolder: "site/",
      actualAssetFolder: "/site//",
      expectedPublicId,
      actualPublicId: expectedPublicId,
    })).toEqual({ valid: true, representation: "asset_folder" });
  });

  it("regresses the failing preset-folder scenario", () => {
    const result = verifyCloudinaryFolderBinding({
      mode: "dynamic",
      expectedFolder,
      actualAssetFolder: "site/",
      expectedPublicId,
      actualPublicId: expectedPublicId,
    });
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining('expected normalized folder "admin/media/images/staff"') });
    expect(result).toMatchObject({ reason: expect.stringContaining('actual normalized folder "site"') });
  });

  it("rejects a different folder, a sub-folder, and a case change", () => {
    for (const actualAssetFolder of ["other", `${expectedFolder}/nested`, "ADMIN/media/images/staff"]) {
      expect(verifyCloudinaryFolderBinding({ mode: "dynamic", expectedFolder, actualAssetFolder, expectedPublicId, actualPublicId: expectedPublicId }).valid).toBe(false);
    }
    expect(verifyCloudinaryFolderBinding({ mode: "dynamic", expectedFolder, actualAssetFolder: `${expectedFolder}/nested`, expectedPublicId, actualPublicId: expectedPublicId, allowSubfolders: true }).valid).toBe(true);
  });

  it("accepts fixed mode only when the exact authorized folder is in the public ID", () => {
    expect(verifyCloudinaryFolderBinding({ mode: "fixed", expectedFolder, expectedPublicId, actualPublicId: expectedPublicId }).valid).toBe(true);
    expect(verifyCloudinaryFolderBinding({ mode: "fixed", expectedFolder, expectedPublicId, actualPublicId: `${expectedFolder}/nested/asset` }).valid).toBe(false);
    expect(verifyCloudinaryFolderBinding({ mode: "fixed", expectedFolder, expectedPublicId, actualPublicId: `other/${expectedPublicId}` }).valid).toBe(false);
    expect(verifyCloudinaryFolderBinding({ mode: "fixed", expectedFolder, expectedPublicId, actualPublicId: expectedPublicId.toUpperCase() }).valid).toBe(false);
  });

  it("rejects cross-folder customer upload identities in fixed mode", () => {
    const customerFolder = "customers/customer/videos";
    const customerPublicId = `${customerFolder}/asset`;
    expect(verifyCloudinaryFolderBinding({
      mode: "fixed",
      expectedFolder: customerFolder,
      expectedPublicId: customerPublicId,
      actualPublicId: "customers/other/videos/asset",
    }).valid).toBe(false);
    expect(verifyCloudinaryFolderBinding({
      mode: "fixed",
      expectedFolder: customerFolder,
      expectedPublicId: customerPublicId,
      actualPublicId: `${customerFolder}/nested/asset`,
    }).valid).toBe(false);
  });
});
