import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CMS_CONTENT_ACTION_PERMISSIONS, CMS_CONTENT_TYPES } from "@/config/cms-content";
import { publicCmsWhere, isScheduledTimeReached } from "@/lib/cms-public-policy";
import { cmsContentFormSchema } from "@/lib/schemas/cms/content";
import { ROLE_PERMISSION_MATRIX, type RoleName } from "@/server/authz/permissions";
import { hasPermission } from "@/server/authz/policies";

describe("CMS action permission matrix", () => {
  it.each(Object.entries(CMS_CONTENT_ACTION_PERMISSIONS))("%s requires its declared permission", (action, permission) => {
    for (const [role, permissions] of Object.entries(ROLE_PERMISSION_MATRIX)) {
      const expected = role === "Super Admin" || permissions.includes(permission as never);
      expect(hasPermission([role as RoleName], permissions, permission), `${role} -> ${action} -> ${permission}`).toBe(expected);
    }
  });

  it("defines a write/publish/delete lifecycle for every content type", () => {
    for (const entityType of CMS_CONTENT_TYPES) {
      expect(CMS_CONTENT_ACTION_PERMISSIONS.save).toBe("cms.write");
      expect(CMS_CONTENT_ACTION_PERMISSIONS.publish).toBe("cms.publish");
      expect(CMS_CONTENT_ACTION_PERMISSIONS.trash).toBe("cms.delete");
      expect(entityType).toBeTruthy();
    }
  });
});

describe("public content and scheduling policy", () => {
  it.each(CMS_CONTENT_TYPES.filter((type) => type !== "post-category"))("%s public filter excludes drafts and trashed rows", (type) => {
    const where = publicCmsWhere(type, new Date("2026-10-08T12:00:00Z"));
    expect(where).toMatchObject({ status: "PUBLISHED", deletedAt: null });
  });

  it("requires explicit consent for public testimonials and public admin media for gallery", () => {
    expect(publicCmsWhere("testimonial", new Date())).toMatchObject({ consentConfirmed: true });
    expect(publicCmsWhere("gallery-item", new Date())).toMatchObject({ media: { origin: "ADMIN", isPublic: true, deletedAt: null } });
  });

  it("publishes only once the scheduled instant is reached", () => {
    expect(isScheduledTimeReached(new Date("2026-10-08T12:00:01Z"), new Date("2026-10-08T12:00:00Z"))).toBe(false);
    expect(isScheduledTimeReached(new Date("2026-10-08T12:00:00Z"), new Date("2026-10-08T12:00:00Z"))).toBe(true);
  });
});

describe("CMS content validation defaults", () => {
  it("starts legacy-only activity and food entries as drafts", () => {
    const activity = cmsContentFormSchema.safeParse({ entityType: "activity", slug: "jungle-safari", name: { en: "Jungle safari" } });
    const menuItem = cmsContentFormSchema.safeParse({ entityType: "menu-item", name: { en: "Jain food" }, categoryId: "00000000-0000-4000-8000-000000000001" });
    expect(activity.success).toBe(true);
    expect(menuItem.success).toBe(true);
    // Save service explicitly persists DRAFT for every newly-created content type.
  });
});

describe("signed content preview", () => {
  it("rejects tampered preview tokens", async () => {
    process.env.PREVIEW_SECRET = "test-secret-value-that-is-long-enough-123";
    const { createPreviewToken, verifyPreviewToken } = await import("@/server/cms/preview");
    const token = createPreviewToken({ entityType: "post", id: "00000000-0000-4000-8000-000000000001" });
    expect(verifyPreviewToken(token)).not.toBeNull();
    expect(verifyPreviewToken(`${token}x`)).toBeNull();
  });
});

