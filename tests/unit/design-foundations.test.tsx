import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilterTabs } from "@/components/marketing/FilterTabs";
import { ImageCard } from "@/components/marketing/ImageCard";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StatStrip } from "@/components/marketing/StatStrip";
import { RevealMotion } from "@/components/motion/RevealMotion";

const filters = [
  { id: "one", label: "Sample one" },
  { id: "two", label: "Sample two" },
  { id: "three", label: "Sample three", disabled: true },
] as const;

describe("marketing foundations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the eyebrow decoration hidden from assistive technology", async () => {
    const { container } = render(<SectionEyebrow>Sample label</SectionEyebrow>);

    expect(screen.getByText("Sample label")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("//");
    expect((await axe(container)).violations).toEqual([]);
  });

  it("moves FilterTabs with roving focus and skips disabled items", () => {
    render(<FilterTabs items={filters} ariaLabel="Sample filters" />);
    const first = screen.getByRole("button", { name: "Sample one" });
    const second = screen.getByRole("button", { name: "Sample two" });
    const disabled = screen.getByRole("button", { name: "Sample three" });

    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");
    expect(disabled).toBeDisabled();

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(second, { key: "Home" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "End" });
    expect(second).toHaveFocus();
  });

  it("renders no output for an empty StatStrip", () => {
    const { container } = render(<StatStrip items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the final visible state when reduced motion is preferred", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    try {
      render(<RevealMotion>Sample reveal</RevealMotion>);

      await waitFor(() => {
        expect(screen.getByText("Sample reveal").parentElement).toHaveStyle({
          opacity: "1",
          transform: "none",
        });
      });
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("keeps the foundation sample composition accessible", async () => {
    const { container } = render(
      <main>
        <SectionHeading
          eyebrow="Sample component"
          title="Sample heading"
          description="Sample description."
        />
        <FilterTabs items={filters.slice(0, 2)} ariaLabel="Sample filters" />
        <StatStrip items={[{ label: "Sample label", value: "Sample value" }]} />
        <ImageCard
          src="/placeholder-farm.svg"
          alt="Sample placeholder image"
          title="Sample image card"
        />
      </main>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
