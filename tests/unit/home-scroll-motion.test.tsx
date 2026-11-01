import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeScrollMotion } from "@/components/marketing/HomeScrollMotion";

describe("HomeScrollMotion", () => {
  beforeEach(() => {
    // Inject mock section elements into document body
    const hero = document.createElement("section");
    hero.id = "hero";
    const stays = document.createElement("section");
    stays.id = "stays";
    const food = document.createElement("section");
    food.id = "food";

    document.body.appendChild(hero);
    document.body.appendChild(stays);
    document.body.appendChild(food);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders desktop section dots for discovered DOM sections", async () => {
    render(<HomeScrollMotion />);

    const nav = screen.getByRole("navigation", { name: "Page sections navigation" });
    expect(nav).toBeInTheDocument();

    await waitFor(() => {
      const heroDot = screen.getByRole("link", { name: "Jump to Top section" });
      expect(heroDot).toHaveAttribute("href", "#hero");

      const staysDot = screen.getByRole("link", { name: "Jump to Stays section" });
      expect(staysDot).toHaveAttribute("href", "#stays");

      const foodDot = screen.getByRole("link", { name: "Jump to Food section" });
      expect(foodDot).toHaveAttribute("href", "#food");
    });
  });

  it("passes axe accessibility tests", async () => {
    const { container } = render(<HomeScrollMotion />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

