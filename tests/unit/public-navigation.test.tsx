import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { LegacyHashRedirect, routeForLegacyHash } from "@/components/marketing/LegacyHashRedirect";
import { LocationDetails } from "@/components/marketing/LocationDetails";
import { PublicNavigation, publicNavigation } from "@/components/marketing/PublicNavigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/gallery",
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("public navigation", () => {
  it("marks the current route and opens the mobile menu", async () => {
    const { container } = render(<PublicNavigation isSignedIn={false} />);
    expect(container.querySelector('a[href="/gallery"][aria-current="page"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(screen.getByRole("dialog", { name: "Site navigation" })).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("uses real public routes for the primary links", () => {
    expect(publicNavigation.map((item) => item.href)).toEqual([
      "/", "/accommodation", "/packages", "/food", "/activities", "/stories", "/gallery", "/rewards", "/contact",
    ]);
  });

  it("renders exactly one account control", () => {
    const { rerender } = render(<PublicNavigation isSignedIn={false} />);
    expect(screen.getAllByText("Login").length).toBeGreaterThan(0);
    expect(screen.queryByText("Account")).toBeNull();
    rerender(<PublicNavigation isSignedIn />);
    expect(screen.getAllByText("Account").length).toBeGreaterThan(0);
    expect(screen.queryByText("Login")).toBeNull();
  });

  it("opens dropdowns by keyboard and closes the previous one", () => {
    render(<PublicNavigation isSignedIn={false} />);
    const stay = screen.getByRole("button", { name: /Stay/ });
    fireEvent.click(stay);
    expect(screen.getByRole("menu", { name: "Stay" })).toBeInTheDocument();
    fireEvent.keyDown(stay, { key: "Escape" });
    expect(stay).toHaveAttribute("aria-expanded", "false");
  });
});

describe("legacy public links", () => {
  it("maps old homepage hashes to real routes", () => {
    expect(routeForLegacyHash("#gallery")).toBe("/gallery");
    expect(routeForLegacyHash("#experience")).toBe("/experiences");
    expect(routeForLegacyHash("#location")).toBe("/contact#find-us");
    expect(routeForLegacyHash("#unknown")).toBeNull();
    expect(render(<LegacyHashRedirect />).container.firstChild).toBeNull();
  });
});

describe("location empty states", () => {
  it("does not render invented contact data or an empty optional section", () => {
    const { container } = render(<LocationDetails settings={{ address: "", phones: [] }} />);
    expect(container.textContent).toContain("Location details are not available yet.");
    expect(container.textContent).not.toContain("How to reach us");
    expect(container.querySelector("a[href*='google.com/maps']")).toBeNull();
  });
});
