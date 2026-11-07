import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ContactPage from "@/app/(public)/contact/page";
import type { PublicSettings } from "@/server/services/public-content";

vi.mock("@/server/services/public-content", () => ({ getPublicSettings: vi.fn(async () => ({
  tagline: "Agri-Tourism & Home Stay", phones: ["+919821502956", "+919359895322"], address: "Farm address",
  whatsappNumber: "+919821502956", whatsappMessage: "Hello", home: { hero: { headline: "", subhead: "", cta: "" }, closing: { headline: "" } },
} as PublicSettings)) }));
vi.mock("@/components/forms/LeadCaptureForms", () => ({ CampOrganiserQuoteForm: () => null, ContactForm: () => null, SchoolGroupForm: () => null }));
vi.mock("@/components/marketing/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/marketing/Header", () => ({ Header: () => null }));
vi.mock("@/components/marketing/PublicClosing", () => ({ PublicClosing: () => null }));
vi.mock("@/components/marketing/PublicPageHeader", () => ({ PublicPageHeader: () => null }));
vi.mock("@/components/marketing/StickyCtaBar", () => ({ StickyCtaBar: () => null }));

describe("contact page phone output", () => {
  it("shows both retained numbers and emits both in JSON-LD", async () => {
    render(await ContactPage());
    expect(screen.getByRole("link", { name: "+91 +919821502956" })).toHaveAttribute("href", "tel:+919821502956");
    expect(screen.getByRole("link", { name: "+91 +919359895322" })).toHaveAttribute("href", "tel:+919359895322");
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(jsonLd?.textContent ?? "{}").mainEntity.telephone).toEqual(["+919821502956", "+919359895322"]);
  });
});
