import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { ExperienceCarousel } from "@/components/marketing/ExperienceCarousel";

const experiences = [
  { id: "one", slug: "horticultural-farming", title: { en: "Horticultural Farming" }, summary: { en: "A farm experience." }, heroMedia: null },
  { id: "two", slug: "dairy-and-poultry", title: { en: "Dairy & Poultry Farming" }, summary: { en: "A rural learning experience." }, heroMedia: null },
] as const;

describe("experience carousel", () => {
  it("renders published CMS experiences and their links", () => {
    render(<ExperienceCarousel experiences={experiences} cloudName="" heading="Published experiences" description="CMS description"/>);

    expect(screen.getByRole("heading", { name: "Published experiences" })).toBeInTheDocument();
    expect(screen.getByText("A farm experience.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Horticultural Farming" })).toHaveAttribute("href", "/experiences/horticultural-farming");
    expect(screen.getByRole("button", { name: "Go to experience 02: Dairy & Poultry Farming" })).toBeInTheDocument();
  });

  it("supports arrow-key navigation and announces user changes", () => {
    render(<ExperienceCarousel experiences={experiences} cloudName=""/>);
    const carousel = screen.getByRole("region", { name: "Our Experiences carousel" });
    const next = screen.getByRole("button", { name: "Next experience" });

    expect(screen.queryByText("Swipe to explore")).toBeInTheDocument();
    carousel.focus();
    fireEvent.keyDown(carousel, { key: "ArrowRight" });

    expect(screen.getByRole("button", { name: "Go to experience 02: Dairy & Poultry Farming" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Showing experience 02: Dairy & Poultry Farming")).toHaveAttribute("aria-live", "polite");
    expect(next).toBeDisabled();
    expect(screen.queryByText("Swipe to explore")).toBeNull();
  });

  it("moves with numbered pagination and has no autoplay timer", () => {
    const intervalSpy = vi.spyOn(window, "setInterval");
    render(<ExperienceCarousel experiences={experiences} cloudName=""/>);
    fireEvent.click(screen.getByRole("button", { name: "Go to experience 02: Dairy & Poultry Farming" }));

    expect(screen.getByRole("button", { name: "Go to experience 02: Dairy & Poultry Farming" })).toHaveAttribute("aria-current", "page");
    expect(intervalSpy).not.toHaveBeenCalled();
    intervalSpy.mockRestore();
  });

  it("renders nothing when no published experiences exist", () => {
    const { container } = render(<ExperienceCarousel experiences={[]} cloudName=""/>);

    expect(container).toBeEmptyDOMElement();
  });

  it("passes an accessibility audit", async () => {
    const { container } = render(<ExperienceCarousel experiences={experiences} cloudName=""/>);

    expect((await axe(container)).violations).toEqual([]);
  });
});
