import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FooterContent } from "@/components/marketing/Footer";
import type { PublicSettings } from "@/server/services/public-content";

const settings = {
  tagline: "Agri-Tourism & Home Stay",
  phones: ["+919821502956", "+919359895322"],
  address: "Farm address",
  whatsappNumber: "+919821502956",
  whatsappMessage: "Hello",
  home: { hero: { headline: "", subhead: "", cta: "" }, closing: { headline: "" } },
} as PublicSettings;

describe("footer contact numbers", () => {
  it("links only to the two retained business numbers", () => {
    render(<FooterContent settings={settings} />);
    expect(screen.getByRole("link", { name: "+919821502956" })).toHaveAttribute("href", "tel:+919821502956");
    expect(screen.getByRole("link", { name: "+919359895322" })).toHaveAttribute("href", "tel:+919359895322");
    expect(screen.getByRole("link", { name: "Message us on WhatsApp" })).toHaveAttribute("href", expect.stringContaining("wa.me/919821502956"));
  });
});
