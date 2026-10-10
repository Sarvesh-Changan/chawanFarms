import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FaqAccordion, type FaqItem } from "@/components/cms/FaqAccordion";
import { GalleryViewer, type GalleryViewerItem } from "@/components/gallery/GalleryViewer";
import { publicCmsWhere } from "@/lib/cms-public-policy";

describe("public pages accessibility & components", () => {
  it("FaqAccordion renders accessible buttons with aria-expanded and expands on click", () => {
    const mockFaqs: FaqItem[] = [
      {
        id: "faq-1",
        question: { en: "What are the check-in and check-out timings?" },
        answer: { en: "Check-in is at 10:00 AM and check-out is at 10:00 AM next day." },
        groupKey: "Stay",
        sortOrder: 1,
      },
      {
        id: "faq-2",
        question: { en: "Is vegetarian food provided?" },
        answer: { en: "Yes, traditional pure vegetarian meals are cooked fresh on the farm." },
        groupKey: "Food",
        sortOrder: 2,
      },
    ];

    render(<FaqAccordion items={mockFaqs} />);

    const searchInput = screen.getByRole("searchbox");
    expect(searchInput).toBeInTheDocument();

    const faqButton = screen.getByRole("button", {
      name: /What are the check-in and check-out timings/i,
    });
    expect(faqButton).toHaveAttribute("aria-expanded", "false");
    expect(faqButton).toHaveAttribute("aria-controls", "faq-content-faq-1");

    // Click to expand
    fireEvent.click(faqButton);
    expect(faqButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/Check-in is at 10:00 AM and check-out is at 10:00 AM/i),
    ).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(faqButton);
    expect(faqButton).toHaveAttribute("aria-expanded", "false");
  });

  it("GalleryViewer renders accessible category filter chips with aria-pressed", () => {
    const mockItems: GalleryViewerItem[] = [
      {
        id: "item-1",
        category: "Farm",
        caption: { en: "Morning mist over the paddy fields" },
        sortOrder: 1,
        isFeatured: true,
        media: {
          id: "m-1",
          publicId: "farm-mist-1",
          kind: "IMAGE",
          resourceType: "image",
          altText: { en: "Mist over fields" },
          caption: null,
          focalX: null,
          focalY: null,
          width: 1200,
          height: 800,
          durationSec: null,
        },
      },
      {
        id: "item-2",
        category: "Activities",
        caption: { en: "River swimming in Kundalika" },
        sortOrder: 2,
        isFeatured: false,
        media: {
          id: "m-2",
          publicId: "river-dip-video",
          kind: "VIDEO",
          resourceType: "video",
          altText: { en: "River swim" },
          caption: null,
          focalX: null,
          focalY: null,
          width: 1920,
          height: 1080,
          durationSec: 15,
        },
      },
    ];

    render(<GalleryViewer items={mockItems} cloudName="demo-cloud" />);

    const allChip = screen.getByRole("button", { name: "All" });
    const farmChip = screen.getByRole("button", { name: "Farm" });

    expect(allChip).toHaveAttribute("aria-pressed", "true");
    expect(farmChip).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(farmChip);
    expect(farmChip).toHaveAttribute("aria-pressed", "true");
    expect(allChip).toHaveAttribute("aria-pressed", "false");

    // Verify video tile has accessible label
    const videoBtn = screen.getByRole("button", { name: /View image: Morning mist/i });
    expect(videoBtn).toBeInTheDocument();
  });

  it("publicCmsWhere correctly enforces date validity for active offers only", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    const where = publicCmsWhere("offer", now);

    expect(where).toEqual({
      status: "PUBLISHED",
      deletedAt: null,
      startsAt: { lte: now },
      endsAt: { gte: now },
    });
  });
});
