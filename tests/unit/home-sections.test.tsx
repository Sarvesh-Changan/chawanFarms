import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { HomeSections } from "@/components/marketing/HomeSections";
import type { PublicHomeData } from "@/server/services/public-content";

vi.mock("@/components/marketing/HomeHero", () => ({ HomeHero: () => <section aria-label="Home hero" /> }));
vi.mock("@/components/marketing/ClosingCta", () => ({ ClosingCta: ({ heading }: { heading: string }) => <section aria-label="Plan your visit"><h2>{heading}</h2></section> }));

const emptyHome = {
  settings: {
    address: "",
    phones: [],
    whatsappNumber: "",
    whatsappMessage: "",
    home: { hero: { media: null }, closing: { headline: "" } },
  },
  packages: [],
  experiences: [],
  gallery: [],
  stories: [],
  food: [],
} as unknown as PublicHomeData;

describe("Home empty content handling", () => {
  it("keeps optional sections hidden when no ready data or images exist", () => {
    render(<HomeSections data={emptyHome} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByLabelText("Home hero")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan your visit")).toBeInTheDocument();
    expect(screen.queryByText(/Stay with us|Time outdoors|A look around|Find the farm/)).toBeNull();
  });

  it("keeps the empty-data Home composition accessible", async () => {
    const { container } = render(<HomeSections data={emptyHome} />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("avoids repeating the hero headline in the closing action", () => {
    const headline = "Come live, experience & rediscover yourself";
    const data = {
      ...emptyHome,
      settings: {
        ...emptyHome.settings,
        home: { hero: { media: null, headline }, closing: { headline: { en: headline } } },
      },
    } as unknown as PublicHomeData;
    render(<HomeSections data={data} />);
    expect(screen.getByRole("heading", { name: "Your farm stay starts here." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: headline })).toBeNull();
  });

  it("renders the owner portrait section only when it is enabled with public media", () => {
    const data = {
      ...emptyHome,
      settings: {
        ...emptyHome.settings,
        owner: {
          display: true,
          name: "Farm owner",
          caption: "A short owner introduction.",
          media: { id: "owner-image", kind: "IMAGE", publicId: "farm/owner" },
        },
      },
    } as unknown as PublicHomeData;
    render(<HomeSections data={data} />);
    expect(screen.getByRole("region", { name: "Farm owner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Farm owner" })).toBeInTheDocument();
    expect(screen.getByText("A short owner introduction.")).toBeInTheDocument();
  });
});
