import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeHero } from "@/components/marketing/HomeHero";

const emptySettings = {
  address: "",
  phones: [],
  whatsappNumber: "",
  whatsappMessage: "",
  home: { hero: { headline: "Settings headline", subhead: "Settings subhead", cta: "Settings CTA", secondaryCta: "Settings secondary CTA" }, closing: { headline: "Closing" } },
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
  it("renders hero copy and CTA labels from Settings", () => {
    render(<HomeHero section={cmsSection} media={null} settings={emptySettings} />);

    expect(screen.getByRole("heading", { name: "Settings headline" })).toBeInTheDocument();
    expect(screen.getByText("CMS eyebrow")).toBeInTheDocument();
    expect(screen.getByText("Settings subhead")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings CTA" })).toHaveAttribute("href", "/book");
    expect(screen.getByRole("link", { name: "Settings secondary CTA" })).toHaveAttribute("href", "#stays");
    expect(screen.queryByRole("link", { name: "Explore experiences" })).toBeNull();
  });

  it("keeps the eyebrow prefix in one place and hides empty inset badges", () => {
    render(<HomeHero section={{ content: { eyebrow: { en: "// // AGRI-TOURISM CENTRE · KOLAD, RAIGAD" } } }} media={null} settings={emptySettings} />);

    expect(screen.getByText("AGRI-TOURISM CENTRE · KOLAD, RAIGAD")).toBeInTheDocument();
    expect(screen.queryByText(/Crops & Trees|Farm Cottages/i)).toBeNull();
    expect(screen.getByText("AGRI-TOURISM CENTRE · KOLAD, RAIGAD").parentElement).toHaveTextContent("// AGRI-TOURISM CENTRE · KOLAD, RAIGAD");
  });

  it("hides the optional facts bar when settings are empty", () => {
    render(<HomeHero section={{ content: { heading: { en: "Sample heading" } } }} media={null} settings={emptySettings} />);

    expect(screen.queryByText("Chawan Farms")).toBeNull();
    expect(screen.queryByRole("link", { name: /Call / })).toBeNull();
  });

  it("keeps address out of the hero and shows only configured call action", () => {
    render(<HomeHero section={{ content: { heading: { en: "Sample heading" } } }} media={null} settings={{ ...emptySettings, address: "Baitwadi, Kolad", phones: ["9821502956"] }} />);

    expect(screen.queryByText("Baitwadi, Kolad")).toBeNull();
    expect(screen.getByRole("link", { name: "Call the farm" })).toHaveAttribute("href", "tel:9821502956");
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
