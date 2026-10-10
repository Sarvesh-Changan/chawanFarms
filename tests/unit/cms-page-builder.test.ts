import { describe, expect, it } from "vitest";

import { PAGE_SECTION_TYPES } from "@/config/page-builder";
import { canPublishPolicy, pageCacheTag, pageRevalidationPaths, pageSectionDefaults } from "@/lib/cms-page-policy";
import { pageBuilderSchema, pageSectionSchema } from "@/lib/schemas/cms/pages";

const pageId = "00000000-0000-4000-8000-000000000001";

describe("page section schemas", () => {
  it("defines valid schema-backed defaults for every configured section", () => {
    for (const type of PAGE_SECTION_TYPES) {
      const content = pageSectionDefaults(type);
      if (type === "hero") content.heading = { en: "Source wording" };
      if (type === "rich-text" || type === "image-text") content.body = { en: "Source wording" };
      expect(pageSectionSchema.safeParse({ type, content, isVisible: true }).success, type).toBe(true);
    }
  });

  it("accepts localized content and rejects unsafe CTA paths and unknown fields", () => {
    expect(pageSectionSchema.safeParse({ type: "hero", content: { heading: { en: "Hello", mr: "नमस्कार" }, ctaHref: "/contact" }, isVisible: true }).success).toBe(true);
    expect(pageSectionSchema.safeParse({ type: "hero", content: { heading: { en: "Hello" }, ctaHref: "//evil.example" }, isVisible: true }).success).toBe(false);
    expect(pageSectionSchema.safeParse({ type: "hero", content: { heading: { en: "Hello" }, adminOnly: true }, isVisible: true }).success).toBe(false);
  });

  it("validates a complete page and its ordered section list", () => {
    const result = pageBuilderSchema.safeParse({ id: pageId, title: { en: "Home" }, sections: [{ type: "hero", content: { heading: { en: "Come live, experience & rediscover yourself & nature at its best" } }, isVisible: true }] });
    expect(result.success).toBe(true);
    expect(pageBuilderSchema.safeParse({ id: pageId, title: { en: "" }, sections: [] }).success).toBe(false);
  });
});

describe("page publish revalidation and policy safeguards", () => {
  it("uses the page route and admin editor paths after Home/About changes", () => {
    expect(pageRevalidationPaths("home")).toEqual(["/", "/admin/cms/pages"]);
    expect(pageRevalidationPaths("about")).toEqual(["/about", "/admin/cms/pages"]);
    expect(pageCacheTag("home")).toBe("cms:page:home");
  });

  it("keeps seeded D-2 policy versions unpublished but permits a resolved new version", () => {
    expect(canPublishPolicy({ key: "stay-rules-and-cancellation", pendingDecision: "D-2 cancellation conflict" })).toBe(false);
    expect(canPublishPolicy({ key: "stay-rules-and-cancellation" })).toBe(true);
    expect(canPublishPolicy({ key: "cancellation" })).toBe(true);
    expect(canPublishPolicy({ key: "privacy" })).toBe(true);
  });
});
