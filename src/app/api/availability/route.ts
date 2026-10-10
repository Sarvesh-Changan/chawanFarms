import { NextResponse } from "next/server";

import { limit } from "@/server/integrations/ratelimit";
import { checkAvailability } from "@/server/services/availability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkIn = url.searchParams.get("checkIn");
  const checkOut = url.searchParams.get("checkOut");
  const accommodationId = url.searchParams.get("accommodationId");
  const accommodationSlug = url.searchParams.get("accommodationSlug");
  const unitsStr = url.searchParams.get("units");

  if (!checkIn || !checkOut) {
    return NextResponse.json(
      { error: "Both 'checkIn' and 'checkOut' query parameters are required (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

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
    const rateLimitRes = await limit(`avail:ip:${ip}`, 60, 60);
    if (!rateLimitRes.allowed) {
      return NextResponse.json(
        { error: "Too many availability requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimitRes.retryAfterSeconds) },
        },
      );
    }
  } catch {
    // If rate limiter fails, allow through in non-critical reads
  }

  try {
    const unitsRequested = unitsStr ? Number.parseInt(unitsStr, 10) : undefined;
    const result = await checkAvailability({
      checkIn,
      checkOut,
      accommodationId: accommodationId || undefined,
      accommodationSlug: accommodationSlug || undefined,
      unitsRequested: Number.isNaN(unitsRequested) ? undefined : unitsRequested,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to verify availability";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
