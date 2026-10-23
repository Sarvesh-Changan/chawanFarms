import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { NatureFeature } from "@/components/marketing/NatureFeature";
import { SpotlightBand } from "@/components/marketing/SpotlightBand";

describe("nature feature", () => {
  it("renders the tick-list from CMS data", () => {
    render(<NatureFeature cloudName="" gallery={[]} section={{ content: { heading: { en: "CMS nature heading" }, body: { en: "CMS nature description" }, items: [{ title: { en: "CMS facility" } }] } }}/>);

    expect(screen.getByRole("heading", { name: "CMS nature heading" })).toBeInTheDocument();
    expect(screen.getByText("CMS facility")).toBeInTheDocument();
    expect(screen.queryByText("Morning and evening tea")).toBeNull();
  });

  it("hides an empty spotlight band", () => {
    const { container } = render(<SpotlightBand section={{ content: { heading: { en: "Empty focus" }, items: [] } }}/>);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the CMS spotlight chips when four are supplied", () => {
    render(<SpotlightBand section={{ content: { items: [
      { label: { en: "Focus one" } },
      { label: { en: "Focus two" } },
      { label: { en: "Focus three" } },
      { label: { en: "Focus four" } },
    ] } }}/>);

    expect(screen.getByText("Focus four")).toBeInTheDocument();
  });

  it("passes an accessibility audit", async () => {
    const { container } = render(<NatureFeature cloudName="" gallery={[]} section={{ content: { items: [] } }}/>);

    expect((await axe(container)).violations).toEqual([]);
  });
});
