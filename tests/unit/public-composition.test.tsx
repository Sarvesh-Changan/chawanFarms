import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { PageSectionsRenderer } from "@/components/cms/PageSectionsRenderer";
import { homeSectionOrder } from "@/components/marketing/HomeSections";

vi.mock("@/server/services/public-content", () => ({ localizedString: (value: unknown) => value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).en === "string" ? (value as Record<string, string>).en : "" }));

describe("public composition QA", () => {
  it("keeps the requested Home teaser order", () => {
    expect(homeSectionOrder.filter((type) => ["hero", "location", "stats", "experiences-grid", "why-chawan", "packages", "gallery", "stories", "rewards-teaser", "final-cta"].includes(type))).toEqual([
      "hero",
      "location",
      "stats",
      "experiences-grid",
      "why-chawan",
      "packages",
      "gallery",
      "stories",
      "rewards-teaser",
      "final-cta",
    ]);
  });

  it("renders one H1 and accessible secondary headings for CMS pages", async () => {
    const { container } = render(<PageSectionsRenderer page={{ title: { en: "QA page" }, images: [], sections: [
      { type: "hero", isVisible: true, content: { heading: { en: "QA page heading" }, body: { en: "Intro" } } },
      { type: "rich-text", isVisible: true, content: { heading: { en: "A secondary section" }, body: { en: "Body" } } },
    ] }}/>);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "A secondary section", level: 2 })).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

});
