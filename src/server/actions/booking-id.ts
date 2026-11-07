"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  ALLOWED_GUEST_ID_FORMATS,
  MAX_GUEST_ID_FILE_BYTES,
} from "@/config/booking-id";
import { env } from "@/config/env";
import { requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";
import {
  createAuthenticatedGuestIdViewUrl,
  createUploadSignature,
  deleteCloudinaryAsset,
  verifyCloudinaryAsset,
} from "@/server/integrations/cloudinary";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";

const draftKeySchema = z.string().uuid("Invalid booking draft identity.");
const publicIdSchema = z.string().min(1).max(255).regex(/^[A-Za-z0-9_/-]+$/);
const guestIdSchema = z.string().uuid("Invalid guest identity.");

function extractClientIp(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = headerList.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = headerList.get("x-real-ip");
  if (real) return real.trim();
  return "127.0.0.1";
}

export type GuestIdSignatureResult =
  | {
      ok: true;
      data: {
        publicId: string;
        assetId: string;
        apiKey: string;
        cloudName: string;
        uploadEndpoint: string;
        signature: string;
        signedParams: Record<string, string | number | boolean>;
        maxBytes: number;
        allowedFormats: readonly string[];
      };
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Creates a dedicated, signed upload signature for a guest identity document.
 * Scoped strictly to `private/booking-ids/{draftKey}/{assetId}`.
 */
export async function createGuestIdSignatureAction(
  rawDraftKey: string,
): Promise<GuestIdSignatureResult> {
  const parsed = draftKeySchema.safeParse(rawDraftKey);
  if (!parsed.success) {
    return { ok: false, error: "Invalid booking draft identity." };
  }
  const draftKey = parsed.data;

  const headerList = await headers();
  const ip = extractClientIp(headerList);
  const sanitizedIp = ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 128);

  // Rate limit: 30 upload signatures per hour per IP
  const rateLimit = await limit(`upload:guest-id:ip:${sanitizedIp}`, 30, 3600);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: `Too many upload attempts. Please try again in ${Math.ceil(
        rateLimit.retryAfterSeconds / 60,
      )} minutes.`,
    };
  }

  const assetId = crypto.randomUUID();
  const webhookUrl = new URL("/api/webhooks/cloudinary", env.NEXT_PUBLIC_SITE_URL).toString();

  try {
    const signed = createUploadSignature({
      purpose: "booking_guest_id",
      userId: draftKey,
      assetId,
      webhookUrl,
    });

    const publicId = `private/booking-ids/${draftKey}/${assetId}`;

    return {
      ok: true,
      data: {
        publicId,
        assetId,
        apiKey: signed.apiKey,
        cloudName: signed.cloudName,
        uploadEndpoint: signed.uploadEndpoint,
        signature: signed.signature,
        signedParams: signed.signedParams,
        maxBytes: signed.maxBytes,
        allowedFormats: signed.allowedFormats,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloudinary uploads are not configured.";
    return { ok: false, error: message };
  }
}

export type VerifyGuestIdResult =
  | {
      ok: true;
      data: {
        mediaId: string;
        publicId: string;
        format: string;
        bytes: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Verifies that the uploaded asset exists in Cloudinary within the authorized draft folder,
 * conforms to the format and byte limits, and records it in Media as a pending customer asset.
 */
export async function verifyGuestIdUploadAction(input: {
  draftKey: string;
  publicId: string;
}): Promise<VerifyGuestIdResult> {
  const parsedDraft = draftKeySchema.safeParse(input.draftKey);
  const parsedPublicId = publicIdSchema.safeParse(input.publicId);

  if (!parsedDraft.success || !parsedPublicId.success) {
    return { ok: false, error: "Invalid upload parameters." };
  }

  const draftKey = parsedDraft.data;
  const publicId = parsedPublicId.data;

  // Strict ownership check: publicId MUST start with authorized draft path
  const expectedPrefix = `private/booking-ids/${draftKey}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    return { ok: false, error: "Asset path is outside the authorized draft folder." };
  }

  const verification = await verifyCloudinaryAsset({
    purpose: "booking_guest_id",
    userId: draftKey,
    publicId,
  });

  if (!verification.valid) {
    return { ok: false, error: verification.reason };
  }

  const { asset } = verification;
  const format = asset.format.toLowerCase();

  if (!ALLOWED_GUEST_ID_FORMATS.map((f) => f.toLowerCase()).includes(format as (typeof ALLOWED_GUEST_ID_FORMATS)[number])) {
    return { ok: false, error: `Format .${format} is not supported. Please upload JPG, PNG, WebP or PDF.` };
  }

  if (asset.bytes > MAX_GUEST_ID_FILE_BYTES) {
    return { ok: false, error: "File exceeds the 5 MB maximum size limit." };
  }

  const pendingUntil = new Date(Date.now() + 24 * 3600 * 1000);

  const media = await db.media.upsert({
    where: { publicId },
    update: {
      format,
      bytes: asset.bytes,
      deletedAt: null,
      meta: {
        draftKey,
        pending: true,
        pendingUntil: pendingUntil.toISOString(),
      },
    },
    create: {
      kind: "IMAGE",
      origin: "CUSTOMER",
      publicId,
      resourceType: "image",
      deliveryType: "authenticated",
      format,
      bytes: asset.bytes,
      isPublic: false,
      meta: {
        draftKey,
        pending: true,
        pendingUntil: pendingUntil.toISOString(),
      },
    },
  });

  return {
    ok: true,
    data: {
      mediaId: media.id,
      publicId: media.publicId,
      format,
      bytes: asset.bytes,
    },
  };
}

/**
 * Removes an unattached guest ID upload if replaced or deleted before submission.
 */
export async function removeGuestIdUploadAction(input: {
  draftKey: string;
  publicId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsedDraft = draftKeySchema.safeParse(input.draftKey);
  const parsedPublicId = publicIdSchema.safeParse(input.publicId);

  if (!parsedDraft.success || !parsedPublicId.success) {
    return { ok: false, error: "Invalid parameters." };
  }

  const draftKey = parsedDraft.data;
  const publicId = parsedPublicId.data;

  if (!publicId.startsWith(`private/booking-ids/${draftKey}/`)) {
    return { ok: false, error: "Unauthorized asset removal." };
  }

  const media = await db.media.findUnique({
    where: { publicId },
    include: { bookingGuest: true },
  });

  if (!media) {
    return { ok: true };
  }

  if (media.bookingGuest) {
    return { ok: false, error: "Cannot remove an ID already attached to a confirmed booking." };
  }

  await deleteCloudinaryAsset({
    publicId,
    resourceType: "image",
    deliveryType: "authenticated",
  });

  await db.media.delete({ where: { id: media.id } }).catch(() => undefined);

  return { ok: true };
}

export type ViewGuestIdDocumentResult =
  | {
      ok: true;
      viewUrl: string;
      guestName: string;
      idType: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Allows authorized staff (permission `bookings.ids.read`) to generate an ephemeral (~60s)
 * signed URL to inspect a guest's identity document. Strictly audit-logged.
 */
export async function viewGuestIdDocumentAction(
  rawGuestId: string,
): Promise<ViewGuestIdDocumentResult> {
  const staff = await requireStaff();
  await requirePermission("bookings.ids.read");

  const parsed = guestIdSchema.safeParse(rawGuestId);
  if (!parsed.success) {
    return { ok: false, error: "Invalid guest record." };
  }

  const headerList = await headers();
  const ip = extractClientIp(headerList);
  const userAgent = headerList.get("user-agent") ?? undefined;

  // Rate limit: 60 views per hour per staff member
  const rateLimit = await limit(`staff:view-id:${staff.id}`, 60, 3600);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: "You have exceeded the rate limit for document views. Please wait before viewing again.",
    };
  }

  const guest = await db.bookingGuest.findUnique({
    where: { id: parsed.data },
    include: {
      idMedia: true,
      booking: {
        select: {
          id: true,
          reference: true,
        },
      },
    },
  });

  if (!guest || !guest.idMedia || guest.idPurgedAt) {
    return {
      ok: false,
      error: "The requested identity document is not available or has already been purged.",
    };
  }

  // Audit log entry: who viewed which guest's ID, when
  await audit({
    actor: { id: staff.id, type: "STAFF" },
    action: "booking.guest_id.view",
    entityType: "BookingGuest",
    entityId: guest.id,
    after: {
      bookingId: guest.booking.id,
      bookingReference: guest.booking.reference,
      guestName: guest.fullName,
      idType: guest.idType,
      ageGroup: guest.ageGroup,
    },
    ip,
    userAgent,
  });

  const viewUrl = createAuthenticatedGuestIdViewUrl({
    publicId: guest.idMedia.publicId,
    format: guest.idMedia.format ?? undefined,
  });

  return {
    ok: true,
    viewUrl,
    guestName: guest.fullName,
    idType: guest.idType,
  };
}

