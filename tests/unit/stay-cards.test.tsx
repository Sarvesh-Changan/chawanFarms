import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { StayCards } from "@/components/marketing/StayCards";
import type { StayCardData } from "@/lib/stay-catalogue";

const items: StayCardData[] = [
  {
    id: "tent-id",
    slug: "tent-stay",
    number: "01",
    title: "Tent stay",
    description: "A published tent stay.",
    category: { id: "tent-dormitory", label: "Tent & Dormitory" },
    image: null,
    foodOptions: ["Veg", "Non-veg"],
    groupNote: null,
    priceLabel: "from ₹1,400 per person",
    childLabel: null,
    infantLabel: null,
  },
  {
    id: "guest-id",
    slug: "guest-house-stay",
    number: "02",
    title: "Guest house stay",
    description: "A published guest house stay.",
    category: { id: "guest-house", label: "Guest House" },
    image: null,
    foodOptions: ["Veg"],
    groupNote: "Minimum 10 persons",
    priceLabel: "Contact us for rates",
    childLabel: "Children 4–10: 60% of adult rate",
    infantLabel: "Under 4: free",
  },
];

describe("stay cards", () => {
  it("filters cards with data-derived categories", () => {
    render(<StayCards items={items} cloudName=""/>);

    fireEvent.click(screen.getByRole("button", { name: "Guest House" }));

    expect(screen.getByRole("heading", { name: "Guest house stay" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tent stay" })).toBeNull();
  });

  it("renders an empty state when there are no published stays", () => {
    render(<StayCards items={[]} cloudName=""/>);

    expect(screen.getByText("No published stays are available yet.")).toBeInTheDocument();
  });

  it("does not show a price when the package has no rate", () => {
    render(<StayCards items={items.slice(1, 2)} cloudName=""/>);

    expect(screen.getByText("Contact us for rates")).toBeInTheDocument();
    expect(screen.queryByText(/from ₹/)).toBeNull();
  });

  it("keeps package and enquiry links addressable", () => {
    render(<StayCards items={items.slice(0, 1)} cloudName=""/>);

    expect(screen.getByRole("link", { name: "Tent stay" })).toHaveAttribute("href", "/packages/tent-stay");
    expect(screen.getByRole("link", { name: "Enquire" })).toHaveAttribute("href", "/book?package=tent-id");
  });

  it("passes an accessibility audit", async () => {
    const { container } = render(<StayCards items={items} cloudName=""/>);

    expect((await axe(container)).violations).toEqual([]);
  });
});
