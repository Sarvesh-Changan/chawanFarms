import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { ClosingCta } from "@/components/marketing/ClosingCta";
import { FooterContent } from "@/components/marketing/Footer";
import { GuestStoriesCarousel } from "@/components/marketing/GuestStoriesCarousel";

vi.mock("@/server/services/public-content", () => ({ getPublicSettings: vi.fn() }));

const testimonials = [{
  id: "story-one",
  authorName: "Asha",
  authorMeta: "Guest",
  quote: { en: "A real guest story from the CMS." },
  consentConfirmed: true,
  media: null,
}] as unknown as Parameters<typeof GuestStoriesCarousel>[0]["testimonials"];

const settings: Parameters<typeof FooterContent>[0]["settings"] = {
  phones: ["+919999999999"],
  address: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra",
  socialLinks: [{ label: "Instagram", url: "https://instagram.com/chawanfarms" }],
  whatsappNumber: "+919999999999",
  whatsappMessage: "Hello",
};

describe("guest stories, closing CTA and footer", () => {
  it("renders no story section when there are no consented testimonials", () => {
    const { container } = render(<GuestStoriesCarousel testimonials={[{ consentConfirmed: false }] as never} cloudName=""/>);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders consented CMS testimonials with accessible controls", async () => {
    const { container } = render(<GuestStoriesCarousel testimonials={testimonials} cloudName=""/>);

    expect(screen.getByRole("heading", { name: "Guest stories" })).toBeInTheDocument();
    expect(screen.getByText(/A real guest story from the CMS/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Guest stories carousel" })).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

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
