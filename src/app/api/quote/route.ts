import { NextResponse } from "next/server";

import { formatINR } from "@/lib/money";
import { quoteRequestSchema } from "@/lib/schemas/booking";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";
import { quote, type RateRow } from "@/server/policies/pricing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // IP rate limiting: 60 requests per minute
  const ip = (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "127.0.0.1"
  )
    .split(",")[0]
    ?.trim()
    .slice(0, 128)
    .replace(/[^a-zA-Z0-9:._-]/g, "_") || "unknown";

  try {
    const rateLimitRes = await limit(`quote:ip:${ip}`, 60, 60);
    if (!rateLimitRes.allowed) {
      return NextResponse.json(
        { error: "Too many quote requests. Please wait a moment." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimitRes.retryAfterSeconds) },
        },
      );
    }
  } catch {
    // Continue if bucket service unavailable
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = parsed.data;

  // 1. Resolve package rates from database
  let dbRates: Array<{
    id: string;
    foodPreference: string | null;
    audience: "ADULT" | "CHILD_4_10" | "INFANT_UNDER_4";
    unit: "PER_PERSON_PER_NIGHT" | "PER_PERSON_PER_DAY" | "PER_UNIT" | "FLAT";
    amountPaise: number;
    percentOfAdult: number | null;
    validFrom: Date | null;
    validTo: Date | null;
    isActive: boolean;
  }> = [];

  if (input.packageSlug) {
    const pkg = await db.package.findFirst({
      where: { slug: input.packageSlug, status: "PUBLISHED", deletedAt: null },
      select: { id: true },
    });
    if (pkg) {
      dbRates = await db.packageRate.findMany({
        where: { packageId: pkg.id, isActive: true },
      });
    }
  }

  const rateCard: RateRow[] = dbRates.map((r) => ({
    id: r.id,
    foodPreference: r.foodPreference as "VEG" | "NON_VEG" | null,
    audience: r.audience,
    unit: r.unit,
    amountPaise: r.amountPaise,
    percentOfAdult: r.percentOfAdult,
    validFrom: r.validFrom,
    validTo: r.validTo,
    isActive: r.isActive,
  }));

  // 2. Resolve tax setting (default 0 bps per D-3)
  const taxSetting = await db.setting.findUnique({
    where: { key: "booking.taxRateBps" },
    select: { value: true },
  });
  const taxRateBps =
    taxSetting?.value && typeof taxSetting.value === "number"
      ? taxSetting.value
      : 0;

  // 3. Compute quote
  const quoteResult = quote(
    {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children4to10: input.children4to10,
      infantsUnder4: input.infantsUnder4,
      packageSlug: input.packageSlug,
      foodPreference: input.foodPreference,
      extras: input.extras,
      taxRateBps,
    },
    rateCard,
  );

  return NextResponse.json({
    estimate: {
      subtotalPaise: quoteResult.subtotalPaise,
      discountPaise: quoteResult.discountPaise,
      taxPaise: quoteResult.taxPaise,
      totalPaise: quoteResult.totalPaise,
      formattedSubtotal: formatINR(quoteResult.subtotalPaise),
      formattedDiscount: formatINR(quoteResult.discountPaise),
      formattedTax: formatINR(quoteResult.taxPaise),
      formattedTotal: formatINR(quoteResult.totalPaise),
      nights: quoteResult.nights,
      lines: quoteResult.lines.map((l) => ({
        ...l,
        formattedUnit: formatINR(l.unitPaise),
        formattedTotal: formatINR(l.totalPaise),
      })),
      requiresManualQuote: quoteResult.requiresManualQuote,
      manualQuoteReason: quoteResult.manualQuoteReason,
      disclaimer: "Final amount confirmed by our team.",
    },
  });
}
