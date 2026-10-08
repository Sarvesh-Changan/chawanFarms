import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { CLOUDINARY_WEBHOOK_MAX_BODY_BYTES, mediaPolicy } from "@/config/media";
import { verifyCloudinaryWebhookSignature } from "@/lib/cloudinary-webhook-signature";
import { identifyMediaPurpose } from "@/lib/media-policy";
import { can } from "@/server/authz";
import { db } from "@/server/db";
import { deleteCloudinaryAsset, verifyCloudinaryAsset } from "@/server/integrations/cloudinary";
import { recordVerifiedMedia } from "@/server/services/media";

const payloadSchema = z.object({
  notification_type: z.string().min(1).max(80),
  public_id: z.string().min(1).max(255).regex(/^[A-Za-z0-9_/-]+$/).optional(),
  resource_type: z.enum(["image", "video", "raw"]).optional(),
}).passthrough();

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > CLOUDINARY_WEBHOOK_MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function POST(request: Request) {
  const timestamp = request.headers.get("x-cld-timestamp") ?? "";
  const signature = request.headers.get("x-cld-signature") ?? "";
  const body = await readBoundedBody(request);
  if (body === null) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  if (!env.CLOUDINARY_API_SECRET || !verifyCloudinaryWebhookSignature({ body, timestamp, signature, apiSecret: env.CLOUDINARY_API_SECRET })) {
    return NextResponse.json({ error: "Invalid Cloudinary webhook signature." }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid Cloudinary webhook payload." }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success || !parsed.data.public_id) return NextResponse.json({ received: true, ignored: true });
  if (parsed.data.notification_type !== "upload" && parsed.data.notification_type !== "eager") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const identity = identifyMediaPurpose(parsed.data.public_id);
  if (!identity) return NextResponse.json({ received: true, ignored: true });
  const account = await db.user.findUnique({ where: { id: identity.userId }, select: { type: true, status: true, emailVerified: true, deletedAt: true } });
  if (!account || account.deletedAt || account.status !== "ACTIVE" || (identity.purpose === "customer_video" && (account.type !== "CUSTOMER" || !account.emailVerified)) || (identity.purpose !== "customer_video" && account.type !== "STAFF")) {
    return NextResponse.json({ received: true, ignored: true });
  }
  if (account.type === "STAFF" && !(await can({ id: identity.userId }, "media.write"))) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const verification = await verifyCloudinaryAsset({ ...identity, publicId: parsed.data.public_id });
  if (!verification.valid) {
    const policy = mediaPolicy(identity.purpose);
    const removed = await deleteCloudinaryAsset({ publicId: parsed.data.public_id, resourceType: policy.resourceType, deliveryType: policy.deliveryType });
    return removed
      ? NextResponse.json({ received: true, rejected: true })
      : NextResponse.json({ error: "Rejected asset cleanup failed." }, { status: 503 });
  }
  if (parsed.data.resource_type && parsed.data.resource_type !== verification.asset.resourceType) {
    return NextResponse.json({ error: "Webhook metadata did not match Cloudinary." }, { status: 400 });
  }
  try {
    await recordVerifiedMedia(verification.asset);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Unable to record Cloudinary event." }, { status: 503 });
  }
}
