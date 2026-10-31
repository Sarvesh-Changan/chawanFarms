import { describe, expect, it } from "vitest";

import { homeSectionOrder } from "@/components/marketing/HomeSections";

describe("public Home composition", () => {
  it("uses fixed sections, keeps Experiences, and excludes removed Page/Offer/Testimonial blocks", () => {
    expect(homeSectionOrder).toContain("experiences-grid");
    expect(homeSectionOrder).not.toContain("stories");
    expect(homeSectionOrder).not.toContain("offers");
    expect(homeSectionOrder).not.toContain("testimonials");
  });
});
