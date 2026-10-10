import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { BookingFlow, type StayTypeOption, type ActivityOption } from "@/components/booking/BookingFlow";
import { submitBookingAction } from "@/server/actions/booking";

// Mock server action
vi.mock("@/server/actions/booking", () => ({
  submitBookingAction: vi.fn(),
}));

const mockStayTypes: StayTypeOption[] = [
  {
    key: "tent_dorm",
    name: "Camping Tents & Dormitory",
    packageSlug: "package-a",
    accommodationSlug: "tent",
    description: "Tents and dormitory stay with farm meals.",
    isDayVisit: false,
    minGuests: 1,
  },
  {
    key: "guest_house",
    name: "Guest House (2 AC Rooms)",
    packageSlug: "package-b",
    accommodationSlug: "guest-house",
    description: "2 AC rooms w/ terrace (min 10 guests).",
    isDayVisit: false,
    minGuests: 10,
  },
  {
    key: "picnic",
    name: "One-day Picnic",
    packageSlug: "one-day-picnic",
    accommodationSlug: "day-visit",
    description: "Day visit 9:30 AM to 5:30 PM.",
    isDayVisit: true,
    minGuests: 1,
  },
];

const mockActivities: ActivityOption[] = [
  {
    id: "act-1",
    slug: "campfire",
    name: "Night Campfire",
    isExtraCost: false,
  },
  {
    id: "act-2",
    slug: "bullock-cart",
    name: "Bullock Cart Ride",
    isExtraCost: true,
    priceNote: "extra cost with prior notice",
  },
];

const mockPolicy = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Stay Rules and Cancellation Policy",
  html: "<p>Original photo ID mandatory. Outside food not permitted.</p><h2>Cancellation Policy</h2><p>Booking confirmed against 100% payment.</p>",
};

const mockSettings = {
  featureCoupons: false,
  whatsappNumber: "+919821502956",
  phoneNumbers: ["9821502956"],
  minLeadDays: 0,
  maxNights: 30,
};

describe("BookingFlow accessible stepper & jest-axe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Mock global fetch for quote calls
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/availability")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ breakdown: [] }),
        });
      }
      if (url.includes("/api/quote")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              estimate: {
                subtotalPaise: 280000,
                discountPaise: 0,
                taxPaise: 0,
                totalPaise: 280000,
                formattedSubtotal: "₹2,800",
                formattedDiscount: "₹0",
                formattedTax: "₹0",
                formattedTotal: "₹2,800",
                nights: 1,
                lines: [
                  {
                    description: "Package A: Veg (2 adults × 1 night)",
                    quantity: 2,
                    unitPaise: 140000,
                    totalPaise: 280000,
                    formattedUnit: "₹1,400",
                    formattedTotal: "₹2,800",
                  },
                ],
                requiresManualQuote: false,
                disclaimer: "Final amount confirmed by our team.",
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("Step 1 (Dates and guests) passes axe accessibility checks and renders ordered list stepper", async () => {
    const { container } = render(
      <BookingFlow
        stayTypes={mockStayTypes}
        activities={mockActivities}
        policy={mockPolicy}
        settings={mockSettings}
        customerProfile={null}
      />,
    );

    // Stepper as an ordered list with aria-current="step"
    const stepperList = screen.getByRole("list", { name: "" });
    expect(stepperList.tagName.toLowerCase()).toBe("ol");

    const activeStep = screen.getByRole("listitem", { current: "step" });
    expect(activeStep).toHaveTextContent("1");
    expect(activeStep).toHaveTextContent("Dates & Guests");

    // Heading focus
    const heading = screen.getByRole("heading", { name: /Select your dates and guests/i });
    expect(heading).toHaveAttribute("tabIndex", "-1");

    // Run axe accessibility check on Step 1
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("Step 2 (Stay type and food) passes axe accessibility checks", async () => {
    const { container } = render(
      <BookingFlow
        stayTypes={mockStayTypes}
        activities={mockActivities}
        policy={mockPolicy}
        settings={mockSettings}
        customerProfile={null}
      />,
    );

    // Enter valid dates on step 1
    const checkInInput = screen.getByLabelText(/Check-in date/i);
    const checkOutInput = screen.getByLabelText(/Check-out date/i);
    fireEvent.change(checkInInput, { target: { value: "20/11/2026" } });
    fireEvent.blur(checkInInput);
    fireEvent.change(checkOutInput, { target: { value: "21/11/2026" } });
    fireEvent.blur(checkOutInput);

    // Click Continue
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(continueBtn);

    // Verify on step 2
    expect(
      screen.getByRole("heading", { name: /Choose stay accommodation & food/i }),
    ).toBeInTheDocument();

    const activeStep = screen.getByRole("listitem", { current: "step" });
    expect(activeStep).toHaveTextContent("2");
    expect(activeStep).toHaveTextContent("Stay & Food");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("Step 3 (Activities and extras) passes axe accessibility checks", async () => {
    const { container } = render(
      <BookingFlow
        stayTypes={mockStayTypes}
        activities={mockActivities}
        policy={mockPolicy}
        settings={mockSettings}
        customerProfile={null}
      />,
    );

    // Step 1
    const checkInInput = screen.getByLabelText(/Check-in date/i);
    const checkOutInput = screen.getByLabelText(/Check-out date/i);
    fireEvent.change(checkInInput, { target: { value: "20/11/2026" } });
    fireEvent.blur(checkInInput);
    fireEvent.change(checkOutInput, { target: { value: "21/11/2026" } });
    fireEvent.blur(checkOutInput);
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(
      screen.getByRole("heading", { name: /Optional farm activities & extras/i }),
    ).toBeInTheDocument();

    const activeStep = screen.getByRole("listitem", { current: "step" });
    expect(activeStep).toHaveTextContent("3");
    expect(activeStep).toHaveTextContent("Activities & Extras");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("Step 4 (Contact details) passes axe accessibility checks", async () => {
    const { container } = render(
      <BookingFlow
        stayTypes={mockStayTypes}
        activities={mockActivities}
        policy={mockPolicy}
        settings={mockSettings}
        customerProfile={null}
      />,
    );

    // Step 1 -> 2 -> 3 -> 4
    const checkInInput = screen.getByLabelText(/Check-in date/i);
    const checkOutInput = screen.getByLabelText(/Check-out date/i);
    fireEvent.change(checkInInput, { target: { value: "20/11/2026" } });
    fireEvent.blur(checkInInput);
    fireEvent.change(checkOutInput, { target: { value: "21/11/2026" } });
    fireEvent.blur(checkOutInput);
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(
      screen.getByRole("heading", { name: /Guest contact information/i }),
    ).toBeInTheDocument();

    const activeStep = screen.getByRole("listitem", { current: "step" });
    expect(activeStep).toHaveTextContent("4");
    expect(activeStep).toHaveTextContent("Contact Details");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("Step 5 (Review & policy agreement) passes axe accessibility checks", async () => {
    const { container } = render(
      <BookingFlow
        stayTypes={mockStayTypes}
        activities={mockActivities}
        policy={mockPolicy}
        settings={mockSettings}
        customerProfile={{
          name: "Pooja Patil",
          phone: "+91 98765 43210",
          email: "pooja@example.com",
        }}
      />,
    );

    // Step 1 -> 2 -> 3 -> 4 -> 5
    const checkInInput = screen.getByLabelText(/Check-in date/i);
    const checkOutInput = screen.getByLabelText(/Check-out date/i);
    fireEvent.change(checkInInput, { target: { value: "20/11/2026" } });
    fireEvent.blur(checkInInput);
    fireEvent.change(checkOutInput, { target: { value: "21/11/2026" } });
    fireEvent.blur(checkOutInput);
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(
      screen.getByRole("heading", { name: /Review booking & confirm request/i }),
    ).toBeInTheDocument();

    const activeStep = screen.getByRole("listitem", { current: "step" });
    expect(activeStep).toHaveTextContent("5");
    expect(activeStep).toHaveTextContent("Review & Confirm");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("displays confirmation screen with reference and payment next steps on submit success", async () => {
    const mockSubmit = vi.mocked(submitBookingAction).mockResolvedValue({
      ok: true,
      data: {
        id: "bkg-123",
        reference: "BKG-2026-000042",
        status: "PENDING_CONFIRMATION",
        subtotalPaise: 280000,
        discountPaise: 0,
        taxPaise: 0,
        totalPaise: 280000,
        nights: 1,
        isDuplicate: false,
        requiresManualQuote: false,
      },
    });

    render(
      <BookingFlow
        stayTypes={mockStayTypes}
        activities={mockActivities}
        policy={mockPolicy}
        settings={mockSettings}
        customerProfile={{
          name: "Suresh Deshmukh",
          phone: "+91 98201 11222",
          email: "suresh@example.com",
        }}
      />,
    );

    // Fast-forward to step 5
    const checkInInput = screen.getByLabelText(/Check-in date/i);
    const checkOutInput = screen.getByLabelText(/Check-out date/i);
    fireEvent.change(checkInInput, { target: { value: "20/11/2026" } });
    fireEvent.blur(checkInInput);
    fireEvent.change(checkOutInput, { target: { value: "21/11/2026" } });
    fireEvent.blur(checkOutInput);
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    // Accept policy checkbox
    const policyCheckbox = screen.getByRole("checkbox", {
      name: /I have read and agree to the Stay Rules and Cancellation Policy/i,
    });
    fireEvent.click(policyCheckbox);

    // Submit
    const submitBtn = screen.getByRole("button", {
      name: /Confirm & Send Booking Request/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByText("BKG-2026-000042")).toBeInTheDocument();
      expect(screen.getByText(/Bank transfer or cheque details/i)).toBeInTheDocument();
      expect(screen.getByText(/Booking is confirmed against 100% payment/i)).toBeInTheDocument();
    });
  });
});
