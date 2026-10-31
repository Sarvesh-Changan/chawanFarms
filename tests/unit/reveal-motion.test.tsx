import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Reveal } from "@/components/motion/Reveal";

describe("Reveal reduced-motion behavior", () => {
  it("renders visible content without movement when reduced motion is preferred", () => {
    const previous = window.matchMedia;
    window.matchMedia = (() => ({ matches: true, media: "(prefers-reduced-motion: reduce)", addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    try {
      render(<Reveal distance={18}>Accessible copy</Reveal>);
      expect(screen.getByText("Accessible copy").closest("[data-reveal-state]")).toHaveAttribute("data-reveal-state", "visible");
    } finally {
      window.matchMedia = previous;
    }
  });
});
