import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { HomeStats } from "@/components/marketing/HomeStats";
import { StatStrip } from "@/components/marketing/StatStrip";
import { WhereWeAre } from "@/components/marketing/WhereWeAre";
import { CountUp } from "@/components/motion/CountUp";

const emptySettings = { address: "", phones: [], whatsappNumber: "", whatsappMessage: "", home: { hero: { headline: "Headline", subhead: "Subhead", cta: "Plan your stay" }, closing: { headline: "Closing" } } };

describe("where we are and stats", () => {
  it("hides optional settings details and map link when settings are empty", () => {
    const { container } = render(<WhereWeAre section={{ content: {} }} settings={emptySettings}/>);

    expect(container.querySelector("address")).toBeNull();
    expect(container.querySelector("a[href^='tel:']")).toBeNull();
    expect(container.querySelector("a[href*='google.com/maps']")).toBeNull();
  });

  it("renders no stats section when the CMS has no approved values", () => {
    const { container } = render(<HomeStats section={{ content: { items: [] } }}/>);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the final count value in the initial render for no-JS and SEO", () => {
    render(<CountUp value={250} suffix=" rooms"/>);

    expect(screen.getByText("250 rooms")).toBeInTheDocument();
  });

  it("keeps the final value immediately when reduced motion is preferred", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, media: "(prefers-reduced-motion: reduce)" }) as unknown as typeof window.matchMedia;
    try {
      render(<CountUp value={250}/>);
      expect(screen.getByText("250")).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("reserves a stable stat value line while counting", () => {
    render(<StatStrip items={[{ label: "Approved sample", countUp: { value: 250 } }]}/>);

    expect(screen.getByText("250").parentElement).toHaveClass("min-h-[1em]");
    expect(screen.getByText("250")).toHaveClass("tabular-nums");
  });

  it("keeps the location block accessible", async () => {
    const { container } = render(<WhereWeAre section={{ content: { heading: { en: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra" } }} } settings={emptySettings}/>);

    expect((await axe(container)).violations).toEqual([]);
  });

  it("loads the Google Maps iframe only after user clicks load", () => {
    const populatedSettings = {
      ...emptySettings,
      address: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra, India",
      phones: ["+91 98215 02956"],
    };

    const { container } = render(
      <WhereWeAre section={{ content: {} }} settings={populatedSettings} />
    );

    // Initial render: no iframe, static placeholder is displayed
    expect(container.querySelector("iframe")).toBeNull();
    const loadButton = screen.getByRole("button", { name: "Load interactive map" });
    expect(loadButton).toBeInTheDocument();

    // Directions and Open in Google Maps links
    const directionsLink = screen.getByRole("link", { name: "Directions" });
    expect(directionsLink).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir/"));
    expect(directionsLink).toHaveAttribute("href", expect.stringContaining("Baitwadi"));

    const openLink = screen.getByRole("link", { name: "Open in Google Maps" });
    expect(openLink).toHaveAttribute("href", expect.stringContaining("google.com/maps/search/"));

    // User clicks the load button
    fireEvent.click(loadButton);

    // Iframe now appears with correct sandbox and title
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("title", expect.stringContaining("Google Maps"));
    expect(iframe).toHaveAttribute("sandbox", expect.stringContaining("allow-scripts"));
  });
});
