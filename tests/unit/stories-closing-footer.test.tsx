import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { ClosingCta } from "@/components/marketing/ClosingCta";
import { FooterContent } from "@/components/marketing/Footer";

vi.mock("@/server/services/public-content", () => ({ getPublicSettings: vi.fn() }));

const settings: Parameters<typeof FooterContent>[0]["settings"] = {
  phones: ["+919999999999"],
  address: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra",
  socialLinks: [{ label: "Instagram", url: "https://instagram.com/chawanfarms" }],
  whatsappNumber: "+919999999999",
  whatsappMessage: "Hello",
  home: { hero: { headline: "Headline", subhead: "Subhead", cta: "Plan your stay" }, closing: { headline: "Closing" } },
};

describe("guest stories, closing CTA and footer", () => {
  it("shows the WhatsApp CTA only when Settings has a number", () => {
    const { rerender } = render(<ClosingCta settings={{ whatsappNumber: "", whatsappMessage: "" }}/>);

    expect(screen.getByRole("link", { name: "Plan your stay" })).toHaveAttribute("href", "/book");
    expect(screen.queryByRole("link", { name: "Chat on WhatsApp" })).toBeNull();
    rerender(<ClosingCta settings={{ whatsappNumber: "+919999999999", whatsappMessage: "Hello" }}/>);
    expect(screen.getByRole("link", { name: "Chat on WhatsApp" })).toHaveAttribute("href", expect.stringContaining("https://wa.me/919999999999"));
  });

  it("renders Settings contact, social and policy links in the footer", async () => {
    const { container } = render(<FooterContent settings={settings}/>);

    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/chawanfarms");
    expect(screen.getByRole("link", { name: "Policies" })).toHaveAttribute("href", "/policies");
    expect(screen.getByRole("link", { name: "+919999999999" })).toHaveAttribute("href", "tel:+919999999999");
    expect((await axe(container)).violations).toEqual([]);
  });
});
