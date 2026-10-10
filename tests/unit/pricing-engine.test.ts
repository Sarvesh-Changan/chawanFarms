import { describe, expect, it } from "vitest";

import {
  calculateChildRatePaise,
  calculateStayNights,
  quote,
  type RateRow,
  type ValidatedCoupon,
} from "@/server/policies/pricing";

// Seeded PDF rate card fixtures
const pdfRateCard: (RateRow & { packageSlug: string })[] = [
  // Part A (Tent / Dormitory)
  { packageSlug: "package-a", foodPreference: "VEG", audience: "ADULT", amountPaise: 140000, percentOfAdult: null },
  { packageSlug: "package-a", foodPreference: "NON_VEG", audience: "ADULT", amountPaise: 180000, percentOfAdult: null },
  { packageSlug: "package-a", foodPreference: "VEG", audience: "CHILD_4_10", amountPaise: 84000, percentOfAdult: 60 },
  { packageSlug: "package-a", foodPreference: "NON_VEG", audience: "CHILD_4_10", amountPaise: 108000, percentOfAdult: 60 },
  { packageSlug: "package-a", foodPreference: "VEG", audience: "INFANT_UNDER_4", amountPaise: 0, percentOfAdult: 0 },
  { packageSlug: "package-a", foodPreference: "NON_VEG", audience: "INFANT_UNDER_4", amountPaise: 0, percentOfAdult: 0 },

  // Part B (Guest House)
  { packageSlug: "package-b", foodPreference: "VEG", audience: "ADULT", amountPaise: 230000, percentOfAdult: null },
  { packageSlug: "package-b", foodPreference: "NON_VEG", audience: "ADULT", amountPaise: 280000, percentOfAdult: null },
  { packageSlug: "package-b", foodPreference: "VEG", audience: "CHILD_4_10", amountPaise: 138000, percentOfAdult: 60 },
  { packageSlug: "package-b", foodPreference: "NON_VEG", audience: "CHILD_4_10", amountPaise: 168000, percentOfAdult: 60 },
  { packageSlug: "package-b", foodPreference: "VEG", audience: "INFANT_UNDER_4", amountPaise: 0, percentOfAdult: 0 },
  { packageSlug: "package-b", foodPreference: "NON_VEG", audience: "INFANT_UNDER_4", amountPaise: 0, percentOfAdult: 0 },

  // Part C (Camp Organiser)
  { packageSlug: "package-c", foodPreference: "VEG", audience: "ADULT", amountPaise: 120000, percentOfAdult: null },
  { packageSlug: "package-c", foodPreference: "NON_VEG", audience: "ADULT", amountPaise: 180000, percentOfAdult: null },
  { packageSlug: "package-c", foodPreference: "VEG", audience: "CHILD_4_10", amountPaise: 72000, percentOfAdult: 60 },
  { packageSlug: "package-c", foodPreference: "NON_VEG", audience: "CHILD_4_10", amountPaise: 108000, percentOfAdult: 60 },
  { packageSlug: "package-c", foodPreference: "VEG", audience: "INFANT_UNDER_4", amountPaise: 0, percentOfAdult: 0 },
  { packageSlug: "package-c", foodPreference: "NON_VEG", audience: "INFANT_UNDER_4", amountPaise: 0, percentOfAdult: 0 },

  // One-Day Picnic
  { packageSlug: "one-day-picnic", foodPreference: null, audience: "ADULT", amountPaise: 110000, percentOfAdult: null },
  { packageSlug: "one-day-picnic", foodPreference: null, audience: "CHILD_4_10", amountPaise: 75000, percentOfAdult: null },
  { packageSlug: "one-day-picnic", foodPreference: null, audience: "INFANT_UNDER_4", amountPaise: 0, percentOfAdult: 0 },
];

function getRatesForPackage(packageSlug: string): RateRow[] {
  return pdfRateCard.filter((r) => r.packageSlug === packageSlug);
}

describe("Pricing Engine (Pure Functions)", () => {
  it("calculates stay nights accurately for overnight stays and day visits", () => {
    expect(calculateStayNights("2026-11-01", "2026-11-02")).toBe(1);
    expect(calculateStayNights("2026-11-01", "2026-11-04")).toBe(3);
    expect(calculateStayNights("2026-11-01", "2026-11-01")).toBe(0); // Day visit
    expect(() => calculateStayNights("2026-11-05", "2026-11-01")).toThrow("checkOut must be on or after checkIn");
  });

  it("calculates integer half-up child rate correctly", () => {
    // 140000 * 60% = 84000 paise (exact)
    expect(calculateChildRatePaise(140000, 60)).toBe(84000);
    // 180000 * 60% = 108000 paise (exact)
    expect(calculateChildRatePaise(180000, 60)).toBe(108000);
    // 230000 * 60% = 138000 paise (exact)
    expect(calculateChildRatePaise(230000, 60)).toBe(138000);
    // Non-trivial rounding check: 100001 * 60% = 60000.6 -> round to 60001
    expect(calculateChildRatePaise(100001, 60)).toBe(60001);
  });

  it("golden test: Part A Veg ₹1400 and Non-Veg ₹1800 with 60% child rate and free infant", () => {
    const rates = getRatesForPackage("package-a");

    // 2 adults, 1 child (4-10), 1 infant under 4 for 1 night, VEG
    const vegResult = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        children4to10: 1,
        infantsUnder4: 1,
        packageSlug: "package-a",
        foodPreference: "VEG",
      },
      rates,
    );

    // 2 * 140000 + 1 * 84000 + 0 = 364000 paise (₹3,640)
    expect(vegResult.subtotalPaise).toBe(364000);
    expect(vegResult.totalPaise).toBe(364000);
    expect(vegResult.nights).toBe(1);
    expect(vegResult.requiresManualQuote).toBe(false);

    // Verify invariant: sum of line items strictly equals subtotalPaise
    const sumLinesVeg = vegResult.lines.reduce((s, l) => s + l.totalPaise, 0);
    expect(sumLinesVeg).toBe(vegResult.subtotalPaise);

    // Non-veg check: 2 adults, 1 child
    const nonVegResult = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        children4to10: 1,
        infantsUnder4: 0,
        packageSlug: "package-a",
        foodPreference: "NON_VEG",
      },
      rates,
    );

    // 2 * 180000 + 1 * 108000 = 468000 paise (₹4,680)
    expect(nonVegResult.subtotalPaise).toBe(468000);
    expect(nonVegResult.totalPaise).toBe(468000);
    const sumLinesNonVeg = nonVegResult.lines.reduce((s, l) => s + l.totalPaise, 0);
    expect(sumLinesNonVeg).toBe(nonVegResult.subtotalPaise);
  });

  it("golden test: Part B Guest House enforces minimum group of 10 persons", () => {
    const rates = getRatesForPackage("package-b");

    // Group of 8 adults -> below minimum 10
    const belowMinResult = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 8,
        children4to10: 0,
        packageSlug: "package-b",
        foodPreference: "VEG",
      },
      rates,
    );

    expect(belowMinResult.requiresManualQuote).toBe(true);
    expect(belowMinResult.subtotalPaise).toBe(0);
    expect(belowMinResult.totalPaise).toBe(0);
    expect(belowMinResult.manualQuoteReason).toContain("minimum group of 10 persons");
    expect(belowMinResult.lines.reduce((s, l) => s + l.totalPaise, 0)).toBe(0);

    // Group of 10 persons (8 adults + 2 children) -> valid auto quote
    const validGroupResult = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 8,
        children4to10: 2,
        packageSlug: "package-b",
        foodPreference: "VEG",
      },
      rates,
    );

    // 8 * 230000 + 2 * 138000 = 1840000 + 276000 = 2116000 paise (₹21,160)
    expect(validGroupResult.requiresManualQuote).toBe(false);
    expect(validGroupResult.subtotalPaise).toBe(2116000);
    expect(validGroupResult.totalPaise).toBe(2116000);
    expect(validGroupResult.lines.reduce((s, l) => s + l.totalPaise, 0)).toBe(validGroupResult.subtotalPaise);
  });

  it("golden test: Part C Camp Organiser requires 30 to 50 persons", () => {
    const rates = getRatesForPackage("package-c");

    // 20 persons -> below 30
    const smallGroup = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 20,
        packageSlug: "package-c",
        foodPreference: "VEG",
      },
      rates,
    );
    expect(smallGroup.requiresManualQuote).toBe(true);
    expect(smallGroup.manualQuoteReason).toContain("groups of 30 to 50 persons");

    // 35 persons -> in range
    const validGroup = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 35,
        packageSlug: "package-c",
        foodPreference: "VEG",
      },
      rates,
    );
    // 35 * 120000 = 4200000 paise (₹42,000)
    expect(validGroup.requiresManualQuote).toBe(false);
    expect(validGroup.subtotalPaise).toBe(4200000);
    expect(validGroup.lines.reduce((s, l) => s + l.totalPaise, 0)).toBe(validGroup.subtotalPaise);

    // 60 persons -> above 50
    const largeGroup = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 60,
        packageSlug: "package-c",
        foodPreference: "VEG",
      },
      rates,
    );
    expect(largeGroup.requiresManualQuote).toBe(true);
  });

  it("golden test: One-Day Picnic ₹1100 adult and ₹750 kid (nights = 0)", () => {
    const rates = getRatesForPackage("one-day-picnic");

    const picnicResult = quote(
      {
        checkIn: "2026-11-15",
        checkOut: "2026-11-15", // Same day
        adults: 4,
        children4to10: 2,
        infantsUnder4: 1,
        packageSlug: "one-day-picnic",
      },
      rates,
    );

    expect(picnicResult.nights).toBe(0);
    // 4 * 110000 + 2 * 75000 + 0 = 440000 + 150000 = 590000 paise (₹5,900)
    expect(picnicResult.subtotalPaise).toBe(590000);
    expect(picnicResult.totalPaise).toBe(590000);
    expect(picnicResult.lines.reduce((s, l) => s + l.totalPaise, 0)).toBe(picnicResult.subtotalPaise);
  });

  it("handles multi-night calculations accurately", () => {
    const rates = getRatesForPackage("package-a");

    const multiNightResult = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-13", // 3 nights
        adults: 2,
        children4to10: 1,
        packageSlug: "package-a",
        foodPreference: "VEG",
      },
      rates,
    );

    expect(multiNightResult.nights).toBe(3);
    // (2 * 140000 + 1 * 84000) * 3 = 364000 * 3 = 1092000 paise (₹10,920)
    expect(multiNightResult.subtotalPaise).toBe(1092000);
    expect(multiNightResult.totalPaise).toBe(1092000);
    expect(multiNightResult.lines.reduce((s, l) => s + l.totalPaise, 0)).toBe(multiNightResult.subtotalPaise);
  });

  it("extras return 0 paise and are labelled 'extra — quoted by our team'", () => {
    const rates = getRatesForPackage("package-a");

    const result = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        packageSlug: "package-a",
        foodPreference: "VEG",
        extras: [
          { name: "Mutton per kg", quantity: 2 },
          { name: "Barbecue setup", quantity: 1 },
          { name: "Bullock cart ride", quantity: 1 },
        ],
      },
      rates,
    );

    // Stay: 2 * 140000 = 280000 paise
    expect(result.subtotalPaise).toBe(280000);
    expect(result.totalPaise).toBe(280000);

    const extraLines = result.lines.filter((l) => l.kind === "EXTRA");
    expect(extraLines).toHaveLength(3);
    for (const el of extraLines) {
      expect(el.unitPaise).toBe(0);
      expect(el.totalPaise).toBe(0);
      expect(el.label).toContain("extra — quoted by our team");
    }

    expect(result.lines.reduce((s, l) => s + l.totalPaise, 0)).toBe(result.subtotalPaise);
  });

  it("evaluates validated coupons and applies discounts correctly", () => {
    const rates = getRatesForPackage("package-a");

    const fixedCoupon: ValidatedCoupon = {
      code: "WELCOME500",
      discountType: "FIXED",
      discountValue: 50000, // ₹500
    };

    const resFixed = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        packageSlug: "package-a",
        foodPreference: "VEG",
        coupon: fixedCoupon,
      },
      rates,
    );

    // Subtotal 280000 - 50000 = 230000 paise
    expect(resFixed.subtotalPaise).toBe(280000);
    expect(resFixed.discountPaise).toBe(50000);
    expect(resFixed.totalPaise).toBe(230000);

    // Percentage coupon: 10%
    const pctCoupon: ValidatedCoupon = {
      code: "FARM10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxDiscountPaise: 20000, // Capped at ₹200 (20000 paise)
    };

    const resPct = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        packageSlug: "package-a",
        foodPreference: "VEG",
        coupon: pctCoupon,
      },
      rates,
    );

    // 10% of 280000 is 28000, but capped at 20000
    expect(resPct.subtotalPaise).toBe(280000);
    expect(resPct.discountPaise).toBe(20000);
    expect(resPct.totalPaise).toBe(260000);
  });

  it("applies taxRateBps correctly when configured", () => {
    const rates = getRatesForPackage("package-a");

    const result = quote(
      {
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
        adults: 2,
        packageSlug: "package-a",
        foodPreference: "VEG",
        taxRateBps: 500, // 5% GST
      },
      rates,
    );

    // Subtotal 280000 * 5% = 14000 paise
    expect(result.subtotalPaise).toBe(280000);
    expect(result.taxPaise).toBe(14000);
    expect(result.totalPaise).toBe(294000);
  });
});
