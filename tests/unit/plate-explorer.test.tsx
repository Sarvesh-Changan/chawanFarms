import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { PlateExplorer } from "@/components/marketing/PlateExplorer";

const mockCategories = [
  {
    id: "cat-breakfast",
    slug: "breakfast",
    name: { en: "Breakfast" },
    items: [
      { id: "item-poha", categoryId: "cat-breakfast", name: { en: "kanda-poha" }, foodPreference: "VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 1, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "poha", meta: null, description: null },
      { id: "item-upma", categoryId: "cat-breakfast", name: { en: "upma" }, foodPreference: "VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 2, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "upma", meta: null, description: null },
      { id: "item-omelette", categoryId: "cat-breakfast", name: { en: "2-egg omelette" }, foodPreference: "NON_VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 3, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "omelette", meta: null, description: null },
    ],
    status: "PUBLISHED" as const,
    publishAt: null,
    sortOrder: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    seedKey: "breakfast",
    meta: null,
  },
  {
    id: "cat-lunch-veg",
    slug: "lunch-dinner-veg",
    name: { en: "Lunch/Dinner (veg)" },
    items: [
      { id: "item-dal", categoryId: "cat-lunch-veg", name: { en: "dal" }, foodPreference: "VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 1, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "dal", meta: null, description: null },
      { id: "item-rice", categoryId: "cat-lunch-veg", name: { en: "rice" }, foodPreference: "VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 2, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "rice", meta: null, description: null },
      { id: "item-bhakri", categoryId: "cat-lunch-veg", name: { en: "four chapati / three bhakri" }, foodPreference: "VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 3, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "bhakri", meta: null, description: null },
    ],
    status: "PUBLISHED" as const,
    publishAt: null,
    sortOrder: 2,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    seedKey: "lunch-veg",
    meta: null,
  },
  {
    id: "cat-lunch-nonveg",
    slug: "lunch-dinner-non-veg",
    name: { en: "Lunch/Dinner (non-veg)" },
    items: [
      { id: "item-nv-dal", categoryId: "cat-lunch-nonveg", name: { en: "dal" }, foodPreference: "NON_VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 1, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "nv-dal", meta: null, description: null },
      { id: "item-nv-chicken", categoryId: "cat-lunch-nonveg", name: { en: "chicken curry" }, foodPreference: "NON_VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 2, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "chicken", meta: null, description: null },
      { id: "item-nv-mutton-extra", categoryId: "cat-lunch-nonveg", name: { en: "mutton prepared as gravy" }, foodPreference: "NON_VEG" as const, isExtraCharge: true, extraPricePaise: 80000, extraUnitLabel: "kg", sortOrder: 3, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "mutton", meta: null, description: null },
    ],
    status: "PUBLISHED" as const,
    publishAt: null,
    sortOrder: 3,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    seedKey: "lunch-nonveg",
    meta: null,
  },
  {
    id: "cat-evening",
    slug: "part-c-evening",
    name: { en: "Evening tea" },
    items: [
      { id: "item-tea", categoryId: "cat-evening", name: { en: "tea/coffee" }, foodPreference: "VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 1, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "tea", meta: null, description: null },
      { id: "item-wada", categoryId: "cat-evening", name: { en: "batata wada" }, foodPreference: "VEG" as const, isExtraCharge: false, extraPricePaise: null, extraUnitLabel: null, sortOrder: 2, isPublished: true, status: "PUBLISHED" as const, publishAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), seedKey: "wada", meta: null, description: null },
    ],
    status: "PUBLISHED" as const,
    publishAt: null,
    sortOrder: 4,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    seedKey: "evening",
    meta: null,
  },
];

describe("PlateExplorer", () => {
  it("renders default lunch & dinner selection and responds to meal tab clicks", () => {
    render(<PlateExplorer categories={mockCategories} />);

    // Default tab is Lunch & dinner
    const lunchTab = screen.getByRole("tab", { name: "Lunch & dinner" });
    expect(lunchTab).toHaveAttribute("aria-selected", "true");

    // Switch to Breakfast tab
    const breakfastTab = screen.getByRole("tab", { name: "Breakfast" });
    fireEvent.click(breakfastTab);
    expect(breakfastTab).toHaveAttribute("aria-selected", "true");
    expect(lunchTab).toHaveAttribute("aria-selected", "false");

    // Breakfast items should be visible
    expect(screen.getByRole("button", { name: /kanda-poha/i })).toBeInTheDocument();
  });

  it("toggles veg and non-veg options and updates item display", () => {
    render(<PlateExplorer categories={mockCategories} />);

    // Default preference is non-veg
    const nonVegRadio = screen.getByRole("radio", { name: "Non-veg" });
    expect(nonVegRadio).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /chicken curry/i })).toBeInTheDocument();

    // Toggle to Veg
    const vegRadio = screen.getByRole("radio", { name: "Veg" });
    fireEvent.click(vegRadio);
    expect(vegRadio).toHaveAttribute("aria-checked", "true");
  });

  it("shows extra charge notice when extra items exist in data", () => {
    render(<PlateExplorer categories={mockCategories} />);

    expect(
      screen.getByText("Mutton, chicken, fish and barbecue are charged extra.")
    ).toBeInTheDocument();
  });

  it("supports keyboard navigation on meal tabs", () => {
    render(<PlateExplorer categories={mockCategories} />);

    const lunchTab = screen.getByRole("tab", { name: "Lunch & dinner" });
    lunchTab.focus();

    // Press ArrowRight to move to Evening tea
    fireEvent.keyDown(lunchTab, { key: "ArrowRight" });
    const eveningTab = screen.getByRole("tab", { name: "Evening tea" });
    expect(eveningTab).toHaveAttribute("aria-selected", "true");

    // Press ArrowLeft to move back to Lunch & dinner
    fireEvent.keyDown(eveningTab, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Lunch & dinner" })).toHaveAttribute("aria-selected", "true");
  });

  it("passes axe accessibility audit", async () => {
    const { container } = render(<PlateExplorer categories={mockCategories} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

