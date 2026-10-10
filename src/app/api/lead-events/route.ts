import { NextResponse } from "next/server";

import { LEAD_FORM_LIMITS } from "@/config/leads";
import { leadEventSchema } from "@/lib/schemas/leads";
import { getSession } from "@/server/auth";
import { limit } from "@/server/integrations/ratelimit";
import { recordLeadClick } from "@/server/services/leads";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 2_048) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = leadEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim().slice(0, 128).replace(/[^a-zA-Z0-9:._-]/g, "_") || "unknown";
  try {
    if (!(await limit(`lead-click:ip:${ip}`, LEAD_FORM_LIMITS.clickEventsPerIp.max, LEAD_FORM_LIMITS.clickEventsPerIp.windowSeconds)).allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    // Public click tracking is anonymous-capable; getSession is optional and does not redirect like requireUser.
    await getSession();
    await recordLeadClick(parsed.data);
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Event unavailable." }, { status: 503 });
  }
}
