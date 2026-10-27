import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeHero } from "@/components/marketing/HomeHero";

const emptySettings = {
  address: "",
  phones: [],
  whatsappNumber: "",
  whatsappMessage: "",
  home: { hero: { headline: "Settings headline", subhead: "Settings subhead", cta: "Settings CTA" }, closing: { headline: "Closing" } },
};

const cmsSection = {
  content: {
    eyebrow: { en: "CMS eyebrow" },
    heading: { en: "CMS headline" },
    body: { en: "CMS supporting line" },
    ctaLabel: { en: "CMS primary action" },
    ctaHref: "/contact",
  },
};

describe("home hero", () => {
  it("renders Settings copy and the two hero actions", () => {
    render(<HomeHero section={cmsSection} media={null} settings={emptySettings} />);

    expect(screen.getByRole("heading", { name: "Settings headline" })).toBeInTheDocument();
    expect(screen.getByText("CMS eyebrow")).toBeInTheDocument();
    expect(screen.getByText("Settings subhead")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings CTA" })).toHaveAttribute("href", "/book");
    expect(screen.getByRole("link", { name: "Explore experiences" })).toHaveAttribute("href", "/experiences");
  });

  it("hides the optional facts bar when settings are empty", () => {
    render(<HomeHero section={{ content: { heading: { en: "Sample heading" } } }} media={null} settings={emptySettings} />);

    expect(screen.queryByText("Chawan Farms")).toBeNull();
    expect(screen.queryByRole("link", { name: /Call / })).toBeNull();
  });

  it("shows only configured address and phone facts", () => {
    render(<HomeHero section={{ content: { heading: { en: "Sample heading" } } }} media={null} settings={{ ...emptySettings, address: "Baitwadi, Kolad", phones: ["9821502956"] }} />);

    expect(screen.getByText("Baitwadi, Kolad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call 9821502956" })).toHaveAttribute("href", "tel:9821502956");
  });

  it("keeps the hero static when reduced motion is preferred", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;

    try {
      const { container } = render(<HomeHero section={cmsSection} media={null} settings={emptySettings} />);

      await waitFor(() => {
        expect(container.querySelector(".hero-line-in")).toBeNull();
        expect(container.querySelector(".hero-copy-in")).toBeNull();
      });
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("passes an accessibility audit", async () => {
    const { container } = render(<HomeHero section={cmsSection} media={null} settings={emptySettings} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
