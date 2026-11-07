import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FoodMenuText } from "@/components/marketing/FoodMenuText";
import type { PublicHomeData } from "@/server/services/public-content";

const categories = [
  {
    id: "lunch",
    slug: "lunch-dinner",
    name: { en: "Lunch / dinner" },
    items: [
      { id: "veg", name: { en: "Dal" }, foodPreference: "VEG", isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null },
      { id: "nonveg", name: { en: "Chicken curry" }, foodPreference: "NON_VEG", isExtraCharge: true, extraPricePaise: 25000, extraUnitLabel: "kg" },
      { id: "both", name: { en: "Rice" }, foodPreference: null, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null },
    ],
  },
] as unknown as NonNullable<PublicHomeData["food"]>;

describe("FoodMenuText", () => {
  it("shows the data in veg and non-veg columns with extra prices and a full menu link", () => {
    render(<FoodMenuText categories={categories} />);

    expect(screen.getByRole("heading", { name: "Lunch & dinner" })).toBeInTheDocument();
    expect(screen.getByText("Dal")).toBeInTheDocument();
    expect(screen.getAllByText("Rice")).toHaveLength(2);
    expect(screen.getByText("Chicken curry")).toBeInTheDocument();
    expect(screen.getByText("₹250 / kg")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /full menu/i })).toHaveAttribute("href", "/food");
    expect(screen.getByText(/Chicken is charged extra/)).toBeInTheDocument();
  });

  it("renders nothing when there are no menu items", () => {
    const firstCat = categories[0];
    const { container } = render(
      <FoodMenuText categories={firstCat ? [{ ...firstCat, items: [] }] : []} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
