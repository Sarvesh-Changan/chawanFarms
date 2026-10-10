/**
 * Pure pricing engine for Chawan Farms.
 * All calculations use integer paise (no floats).
 * Follows client PDF rate cards and confirmed Phase 10 decisions.
 */

export type FoodPreference = "VEG" | "NON_VEG";

export type RateAudience = "ADULT" | "CHILD_4_10" | "INFANT_UNDER_4";

export type PricingUnit =
  | "PER_PERSON_PER_NIGHT"
  | "PER_PERSON_PER_DAY"
  | "PER_UNIT"
  | "FLAT";

export type RateRow = {
  id?: string;
  foodPreference?: FoodPreference | null;
  audience: RateAudience;
  unit?: PricingUnit;
  amountPaise: number;
  percentOfAdult?: number | null;
  validFrom?: Date | string | null;
  validTo?: Date | string | null;
  isActive?: boolean;
};

export type ValidatedCoupon = {
  code: string;
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number; // paise if FIXED, percent (0-100) if PERCENTAGE
  maxDiscountPaise?: number | null;
  minBookingPaise?: number | null;
};

export type QuoteExtraInput = {
  name: string;
  quantity?: number;
  note?: string;
};

export type QuoteInput = {
  checkIn: Date | string;
  checkOut: Date | string;
  adults: number;
  children4to10?: number;
  infantsUnder4?: number;
  packageSlug?: string | null;
  foodPreference?: FoodPreference | null;
  extras?: QuoteExtraInput[];
  coupon?: ValidatedCoupon | null;
  taxRateBps?: number; // Basis points: 0 = 0%, 500 = 5%, default 0
};

export type QuoteLine = {
  kind: "STAY" | "FOOD_EXTRA" | "ACTIVITY" | "EXTRA";
  label: string;
  quantity: number;
  unitPaise: number;
  totalPaise: number;
  refId?: string | null;
  meta?: Record<string, unknown> | null;
};

export type QuoteSnapshot = {
  packageSlug?: string | null;
  foodPreference?: FoodPreference | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children4to10: number;
  infantsUnder4: number;
  adultRatePaise: number;
  childRatePaise: number;
  taxRateBps: number;
  couponCode?: string | null;
  requiresManualQuote: boolean;
  manualQuoteReason?: string | null;
  calculatedAt: string;
};

export type QuoteResult = {
  lines: QuoteLine[];
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  nights: number;
  requiresManualQuote: boolean;
  manualQuoteReason?: string | null;
  snapshot: QuoteSnapshot;
};

/**
 * Calculates calendar nights between checkIn and checkOut.
 * Day visits (e.g. one-day picnic) have checkIn == checkOut -> 0 nights.
 */
export function calculateStayNights(checkIn: Date | string, checkOut: Date | string): number {
  const dIn = typeof checkIn === "string" ? new Date(`${checkIn.slice(0, 10)}T00:00:00Z`) : new Date(checkIn);
  const dOut = typeof checkOut === "string" ? new Date(`${checkOut.slice(0, 10)}T00:00:00Z`) : new Date(checkOut);

  const msDiff = dOut.getTime() - dIn.getTime();
  if (msDiff < 0) {
    throw new Error("checkOut must be on or after checkIn");
  }

  const days = Math.round(msDiff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Selects the matching rate row valid on the checkIn date.
 */
function findRateRow(
  rates: RateRow[],
  audience: RateAudience,
  foodPreference?: FoodPreference | null,
  checkInDate?: Date,
): RateRow | undefined {
  return rates.find((r) => {
    if (r.isActive === false) return false;
    if (r.audience !== audience) return false;

    // Food preference matching
    if (foodPreference) {
      if (r.foodPreference && r.foodPreference !== foodPreference) return false;
    } else {
      // If no food preference specified, match null or any
      if (r.foodPreference !== null && r.foodPreference !== undefined) {
        // Can be matched if only one rate exists
      }
    }

    // Date validity matching
    if (checkInDate) {
      if (r.validFrom) {
        const from = new Date(r.validFrom);
        if (checkInDate < from) return false;
      }
      if (r.validTo) {
        const to = new Date(r.validTo);
        if (checkInDate > to) return false;
      }
    }

    return true;
  });
}

/**
 * Integer half-up child rate formula:
 * (adultRate * percentOfAdult + 50) / 100
 */
export function calculateChildRatePaise(adultRatePaise: number, percentOfAdult: number): number {
  return Math.floor((adultRatePaise * percentOfAdult + 50) / 100);
}

/**
 * Pure quotation function.
 * Evaluates inputs against the rate card and business rules.
 */
export function quote(input: QuoteInput, rateCard: RateRow[]): QuoteResult {
  const checkInStr = typeof input.checkIn === "string" ? input.checkIn.slice(0, 10) : input.checkIn.toISOString().slice(0, 10);
  const checkOutStr = typeof input.checkOut === "string" ? input.checkOut.slice(0, 10) : input.checkOut.toISOString().slice(0, 10);
  const checkInDate = new Date(`${checkInStr}T00:00:00Z`);

  const nights = calculateStayNights(input.checkIn, input.checkOut);
  const adults = Math.max(0, input.adults);
  const children4to10 = Math.max(0, input.children4to10 ?? 0);
  const infantsUnder4 = Math.max(0, input.infantsUnder4 ?? 0);
  const totalGuests = adults + children4to10;
  const multiplier = nights > 0 ? nights : 1;

  // 1. Group size validation based on confirmed Phase 10 decisions:
  let requiresManualQuote = false;
  let manualQuoteReason: string | null = null;

  if (input.packageSlug === "package-b" && totalGuests < 10) {
    requiresManualQuote = true;
    manualQuoteReason = "Part B (Guest House) requires a minimum group of 10 persons. Your request will be reviewed manually by our reservations team.";
  } else if (input.packageSlug === "package-c" && (totalGuests < 30 || totalGuests > 50)) {
    requiresManualQuote = true;
    manualQuoteReason = "Part C (Camp Organiser) is designed for groups of 30 to 50 persons. Your request will be reviewed manually by our team.";
  }

  // 2. Resolve adult and child rates
  const adultRow = findRateRow(rateCard, "ADULT", input.foodPreference, checkInDate);
  const adultRatePaise = adultRow?.amountPaise ?? 0;

  const childRow = findRateRow(rateCard, "CHILD_4_10", input.foodPreference, checkInDate);
  let childRatePaise = 0;
  if (childRow) {
    if (childRow.percentOfAdult !== null && childRow.percentOfAdult !== undefined && childRow.percentOfAdult > 0) {
      childRatePaise = calculateChildRatePaise(adultRatePaise, childRow.percentOfAdult);
    } else {
      childRatePaise = childRow.amountPaise;
    }
  } else if (adultRatePaise > 0) {
    // Default 60% rule from PDF Appendix A
    childRatePaise = calculateChildRatePaise(adultRatePaise, 60);
  }

  // 3. Build line items
  const lines: QuoteLine[] = [];

  if (requiresManualQuote) {
    // Return line items itemising party composition with 0 total and note
    if (adults > 0) {
      lines.push({
        kind: "STAY",
        label: `Adults (${adults} guest${adults > 1 ? "s" : ""}) — Quote pending team review`,
        quantity: adults * multiplier,
        unitPaise: 0,
        totalPaise: 0,
      });
    }
    if (children4to10 > 0) {
      lines.push({
        kind: "STAY",
        label: `Children 4–10 yrs (${children4to10} child${children4to10 > 1 ? "ren" : ""}) — Quote pending team review`,
        quantity: children4to10 * multiplier,
        unitPaise: 0,
        totalPaise: 0,
      });
    }
  } else {
    // Standard calculation
    if (adults > 0) {
      const adultLineTotal = adults * adultRatePaise * multiplier;
      const stayDurationLabel = nights > 0 ? ` × ${nights} night${nights > 1 ? "s" : ""}` : "";
      lines.push({
        kind: "STAY",
        label: `Adults (${adults} guest${adults > 1 ? "s" : ""}${stayDurationLabel})`,
        quantity: adults * multiplier,
        unitPaise: adultRatePaise,
        totalPaise: adultLineTotal,
      });
    }

    if (children4to10 > 0) {
      const childLineTotal = children4to10 * childRatePaise * multiplier;
      const stayDurationLabel = nights > 0 ? ` × ${nights} night${nights > 1 ? "s" : ""}` : "";
      lines.push({
        kind: "STAY",
        label: `Children 4–10 yrs (${children4to10} child${children4to10 > 1 ? "ren" : ""}${stayDurationLabel})`,
        quantity: children4to10 * multiplier,
        unitPaise: childRatePaise,
        totalPaise: childLineTotal,
      });
    }
  }

  if (infantsUnder4 > 0) {
    lines.push({
      kind: "STAY",
      label: `Infants under 4 yrs (${infantsUnder4} infant${infantsUnder4 > 1 ? "s" : ""} — Free)`,
      quantity: infantsUnder4 * multiplier,
      unitPaise: 0,
      totalPaise: 0,
    });
  }

  // 4. Extras per D-18: return 0 with label "extra — quoted by our team"
  if (input.extras && input.extras.length > 0) {
    for (const extra of input.extras) {
      lines.push({
        kind: "EXTRA",
        label: `${extra.name} (extra — quoted by our team)`,
        quantity: extra.quantity ?? 1,
        unitPaise: 0,
        totalPaise: 0,
        meta: extra.note ? { note: extra.note } : null,
      });
    }
  }

  // 5. Subtotal calculation (strictly sum of lines)
  const subtotalPaise = lines.reduce((acc, line) => acc + line.totalPaise, 0);

  // 6. Discount calculation (if validated coupon present and not manual quote)
  let discountPaise = 0;
  if (!requiresManualQuote && input.coupon && subtotalPaise > 0) {
    const coupon = input.coupon;
    const minRequired = coupon.minBookingPaise ?? 0;

    if (subtotalPaise >= minRequired) {
      if (coupon.discountType === "FIXED") {
        discountPaise = Math.min(coupon.discountValue, subtotalPaise);
      } else if (coupon.discountType === "PERCENTAGE") {
        // (subtotal * percent + 50) / 100
        discountPaise = Math.floor((subtotalPaise * coupon.discountValue + 50) / 100);
      }

      if (coupon.maxDiscountPaise && coupon.maxDiscountPaise > 0) {
        discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
      }

      discountPaise = Math.max(0, Math.min(discountPaise, subtotalPaise));
    }
  }

  // 7. Tax calculation (per D-3: taxRateBps default 0)
  const taxRateBps = Math.max(0, input.taxRateBps ?? 0);
  const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
  const taxPaise = taxRateBps > 0
    ? Math.floor((taxablePaise * taxRateBps + 5000) / 10000)
    : 0;

  // 8. Total amount
  const totalPaise = taxablePaise + taxPaise;

  const snapshot: QuoteSnapshot = {
    packageSlug: input.packageSlug ?? null,
    foodPreference: input.foodPreference ?? null,
    checkIn: checkInStr,
    checkOut: checkOutStr,
    nights,
    adults,
    children4to10,
    infantsUnder4,
    adultRatePaise,
    childRatePaise,
    taxRateBps,
    couponCode: input.coupon?.code ?? null,
    requiresManualQuote,
    manualQuoteReason,
    calculatedAt: new Date().toISOString(),
  };

  return {
    lines,
    subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise,
    nights,
    requiresManualQuote,
    manualQuoteReason,
    snapshot,
  };
}
