import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { PublicPageHeader } from "@/components/marketing/PublicPageHeader";

describe("shared public page header", () => {
  it("renders a single page title and breadcrumb", () => {
    render(<PublicPageHeader currentPage="Packages" eyebrow="Stay with us" title="Choose your stay" description="Published stays." />);
    expect(screen.getByRole("heading", { level: 1, name: "Choose your stay" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Packages");
  });

  it("passes an accessibility audit", async () => {
    const { container } = render(<PublicPageHeader currentPage="Gallery" eyebrow="A look around" title="The farm, in pictures." description="Photographs selected by the farm team." />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
