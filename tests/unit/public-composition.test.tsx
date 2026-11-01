import { describe, expect, it } from "vitest";

import { homeSectionOrder } from "@/components/marketing/HomeSections";

describe("public Home composition", () => {
  it("keeps Home short and excludes duplicate, unsupported and removed blocks", () => {
    expect(homeSectionOrder).toEqual([
      "hero",
      "stays",
      "activities",
      "parallax-scene",
      "stories",
      "food",
      "location",
      "closing-cta",
    ]);
    expect(homeSectionOrder).not.toContain("rewards-teaser");
    expect(homeSectionOrder).not.toContain("accommodation");
    expect(homeSectionOrder).toContain("stories");
    expect(homeSectionOrder).not.toContain("offers");
    expect(homeSectionOrder).not.toContain("testimonials");
  });
});
