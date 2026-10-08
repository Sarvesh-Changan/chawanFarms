import { NextResponse } from "next/server";
import { z } from "zod";

import { MEDIA_API_MAX_REQUEST_BYTES, mediaPolicy } from "@/config/media";
import { identifyMediaPurpose } from "@/lib/media-policy";
import { getSession } from "@/server/auth";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { db } from "@/server/db";
import { deleteCloudinaryAsset, verifyCloudinaryAsset } from "@/server/integrations/cloudinary";
import { recordVerifiedMedia } from "@/server/services/media";

const requestSchema = z.object({ publicId: z.string().min(1).max(255).regex(/^[A-Za-z0-9_/-]+$/) }).strict();

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
  if (!parsed.success) return NextResponse.json({ error: "Invalid Cloudinary asset." }, { status: 422 });
  const identity = identifyMediaPurpose(parsed.data.publicId);
  if (!identity || identity.userId !== session.user.id) return NextResponse.json({ error: "Asset is not available to this account." }, { status: 404 });

  const account = await db.user.findUnique({ where: { id: session.user.id }, select: { type: true, status: true, emailVerified: true, deletedAt: true } });
  if (!account || account.status !== "ACTIVE" || account.deletedAt) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
  if (identity.purpose === "customer_video") {
    if (account.type !== "CUSTOMER" || !account.emailVerified) return NextResponse.json({ error: "Verified customer access required." }, { status: 403 });
  } else {
    if (account.type !== "STAFF") return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    try {
      await requirePermission("media.write");
    } catch (error) {
      const status = error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json({ error: "Media permission required." }, { status });
    }
  }

  const verification = await verifyCloudinaryAsset({ ...identity, publicId: parsed.data.publicId });
  if (!verification.valid) {
    const policy = mediaPolicy(identity.purpose);
    await deleteCloudinaryAsset({ publicId: parsed.data.publicId, resourceType: policy.resourceType, deliveryType: policy.deliveryType });
    return NextResponse.json({ error: "Cloudinary rejected this asset's metadata or upload limits." }, { status: 422 });
  }
  try {
    const media = await recordVerifiedMedia(verification.asset);
    return NextResponse.json({ mediaId: media.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to record verified media." }, { status: 503 });
  }
}
