import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { CUSTOMER_UPLOAD_RATE_LIMIT, MEDIA_API_MAX_REQUEST_BYTES, MEDIA_PURPOSE_KEYS } from "@/config/media";
import { getSession } from "@/server/auth";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { db } from "@/server/db";
import { createUploadSignature } from "@/server/integrations/cloudinary";
import { limit } from "@/server/integrations/ratelimit";

const requestSchema = z.object({ purpose: z.enum(MEDIA_PURPOSE_KEYS) }).strict();
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MEDIA_API_MAX_REQUEST_BYTES) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(rawInput);
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload purpose." }, { status: 422 });

  const account = await db.user.findUnique({ where: { id: session.user.id }, select: { type: true, status: true, emailVerified: true, deletedAt: true } });
  if (!account || account.status !== "ACTIVE" || account.deletedAt) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });

  if (account.type === "CUSTOMER") {
    if (parsed.data.purpose !== "customer_video" || !account.emailVerified) {
      return NextResponse.json({ error: "This upload is not available for this account." }, { status: 403 });
    }
    try {
      const rate = await limit(`media:signature:user:${session.user.id}`, CUSTOMER_UPLOAD_RATE_LIMIT.max, CUSTOMER_UPLOAD_RATE_LIMIT.windowSeconds);
      if (!rate.allowed) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    } catch {
      return NextResponse.json({ error: "Upload service is temporarily unavailable." }, { status: 503 });
    }
  } else {
    if (parsed.data.purpose === "customer_video") return NextResponse.json({ error: "This upload is not available for staff." }, { status: 403 });
    try {
      await requirePermission("media.write");
    } catch (error) {
      const status = error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json({ error: "Media permission required." }, { status });
    }
  }

  try {
    const webhookUrl = new URL("/api/webhooks/cloudinary", env.NEXT_PUBLIC_SITE_URL).toString();
    const signed = createUploadSignature({ purpose: parsed.data.purpose, userId: session.user.id, webhookUrl });
    return NextResponse.json(signed, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Cloudinary uploads are not configured." }, { status: 503 });
  }
}
