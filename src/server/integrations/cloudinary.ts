import "server-only";

import { randomUUID } from "node:crypto";

import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";

import { env } from "@/config/env";
import { mediaPolicy, type MediaPurpose } from "@/config/media";
import { VIDEO_PREVIEW_TTL_SECONDS } from "@/config/moderation";
import { buildCloudinaryUploadParams, validateCloudinaryAssetMetadata } from "@/lib/media-policy";

const publicIdSchema = z.string().min(1).max(255).regex(/^[A-Za-z0-9_/-]+$/);
const assetResponseSchema = z.object({
  public_id: publicIdSchema,
  resource_type: z.enum(["image", "video", "raw"]),
  type: z.string().min(1),
  format: z.string().min(1).max(32),
  bytes: z.number().int().nonnegative(),
  duration: z.number().finite().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  asset_folder: z.string().optional(),
  folder: z.string().optional(),
  etag: z.string().optional(),
}).passthrough();

export type VerifiedCloudinaryAsset = {
  publicId: string;
  kind: "IMAGE" | "VIDEO";
  origin: "ADMIN" | "CUSTOMER";
  resourceType: "image" | "video";
  deliveryType: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  contentHash?: string;
  uploadedById: string;
};

function cloudinaryConfig() {
  const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } = env;
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary server credentials are not configured.");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return { apiKey: CLOUDINARY_API_KEY, apiSecret: CLOUDINARY_API_SECRET, cloudName: CLOUDINARY_CLOUD_NAME };
}

function cloudinaryTestMode(): boolean {
  return env.CLOUDINARY_TEST_MODE && env.APP_ENV !== "production";
}

function presetForPurpose(purpose: MediaPurpose): string {
  const presetName = purpose === "customer_video"
    ? env.CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO
    : purpose === "admin_image"
      ? env.CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE
      : env.CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO;
  if (!presetName) throw new Error(`Cloudinary preset for ${purpose} is not configured.`);
  return presetName;
}

export function createUploadSignature(input: {
  purpose: MediaPurpose;
  userId: string;
  webhookUrl: string;
  assetId?: string;
}) {
  const policy = mediaPolicy(input.purpose);
  if (cloudinaryTestMode()) {
    const assetId = input.assetId ?? randomUUID();
    const signedParams = { public_id: `${policy.folder(input.userId)}/${assetId}`, timestamp: Math.floor(Date.now() / 1000), upload_preset: "test-stub" };
    return {
      cloudName: "test-cloud",
      apiKey: "test-key",
      resourceType: policy.resourceType,
      signature: "test-signature",
      signedParams,
      allowedFormats: policy.formats,
      maxBytes: policy.maxBytes,
      maxDurationSeconds: policy.maxDurationSeconds,
      uploadEndpoint: new URL("/api/test/cloudinary-upload", env.NEXT_PUBLIC_SITE_URL).toString(),
    };
  }
  const credentials = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const uploadPreset = presetForPurpose(input.purpose);
  const signedParams = buildCloudinaryUploadParams({
    ...input,
    assetId: input.assetId ?? randomUUID(),
    timestamp,
    uploadPreset,
    notificationUrl: input.webhookUrl,
  });
  if (!signedParams) throw new Error("The upload identity is invalid.");
  return {
    cloudName: credentials.cloudName,
    apiKey: credentials.apiKey,
    resourceType: policy.resourceType,
    signature: cloudinary.utils.api_sign_request(signedParams, credentials.apiSecret),
    signedParams,
    allowedFormats: policy.formats,
    maxBytes: policy.maxBytes,
    maxDurationSeconds: policy.maxDurationSeconds,
    uploadEndpoint: `https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/${policy.resourceType}/upload`,
  };
}

export async function verifyCloudinaryAsset(input: {
  purpose: MediaPurpose;
  userId: string;
  publicId: string;
}): Promise<{ valid: true; asset: VerifiedCloudinaryAsset } | { valid: false; reason: string }> {
  const publicId = publicIdSchema.safeParse(input.publicId);
  if (!publicId.success) return { valid: false, reason: "Invalid Cloudinary public ID." };
  if (cloudinaryTestMode()) {
    const policy = mediaPolicy(input.purpose);
    return {
      valid: true,
      asset: {
        publicId: publicId.data,
        kind: policy.kind,
        origin: policy.origin,
        resourceType: policy.resourceType,
        deliveryType: policy.deliveryType,
        format: "mp4",
        bytes: 1_000,
        durationSec: 10,
        contentHash: "cloudinary-test-asset-hash",
        uploadedById: input.userId,
      },
    };
  }
  cloudinaryConfig();
  const policy = mediaPolicy(input.purpose);
  let response: unknown;
  try {
    response = await cloudinary.api.resource(publicId.data, {
      resource_type: policy.resourceType,
      type: policy.deliveryType,
    });
  } catch {
    return { valid: false, reason: "Cloudinary asset was not found." };
  }

  const parsed = assetResponseSchema.safeParse(response);
  if (!parsed.success) return { valid: false, reason: "Cloudinary returned incomplete asset metadata." };
  const remote = parsed.data;
  const metadata = {
    publicId: remote.public_id,
    resourceType: remote.resource_type,
    deliveryType: remote.type,
    format: remote.format,
    bytes: remote.bytes,
    duration: remote.duration,
    folder: remote.asset_folder ?? remote.folder,
  };
  if (remote.public_id !== input.publicId) return { valid: false, reason: "Cloudinary returned a different asset identity." };
  const policyResult = validateCloudinaryAssetMetadata(input.purpose, input.userId, metadata);
  if (!policyResult.valid) return policyResult;

  return {
    valid: true,
    asset: {
      publicId: remote.public_id,
      kind: policy.kind,
      origin: policy.origin,
      resourceType: policy.resourceType,
      deliveryType: policy.deliveryType,
      format: remote.format.toLowerCase(),
      bytes: remote.bytes,
      ...(remote.width ? { width: remote.width } : {}),
      ...(remote.height ? { height: remote.height } : {}),
      ...(remote.duration !== undefined ? { durationSec: remote.duration } : {}),
      ...(remote.etag ? { contentHash: remote.etag } : {}),
      uploadedById: input.userId,
    },
  };
}

export async function deleteCloudinaryAsset(input: {
  publicId: string;
  resourceType: "image" | "video";
  deliveryType: "upload" | "authenticated";
}): Promise<boolean> {
  const parsed = z.object({ publicId: publicIdSchema, resourceType: z.enum(["image", "video"]), deliveryType: z.enum(["upload", "authenticated"]) }).strict().safeParse(input);
  if (!parsed.success) return false;
  if (cloudinaryTestMode()) return true;
  cloudinaryConfig();
  try {
    const result = await cloudinary.uploader.destroy(parsed.data.publicId, {
      resource_type: parsed.data.resourceType,
      type: parsed.data.deliveryType,
      invalidate: true,
    });
    return result.result === "ok" || result.result === "not found";
  } catch {
    return false;
  }
}

/** Generate a short-lived authenticated delivery URL. Never persist or log the result. */
export function createAuthenticatedVideoPreviewUrl(input: { publicId: string; format?: string }): string {
  const parsed = z.object({ publicId: publicIdSchema, format: z.string().regex(/^[a-z0-9]{2,8}$/i).optional() }).strict().safeParse(input);
  if (!parsed.success) throw new Error("Invalid preview asset.");
  if (cloudinaryTestMode()) return `https://test-cloudinary.invalid/authenticated/${encodeURIComponent(parsed.data.publicId)}?expires=${Math.floor(Date.now() / 1000) + VIDEO_PREVIEW_TTL_SECONDS}`;
  cloudinaryConfig();
  return cloudinary.utils.private_download_url(parsed.data.publicId, parsed.data.format ?? "mp4", {
    resource_type: "video",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + VIDEO_PREVIEW_TTL_SECONDS,
    attachment: false,
  });
}

/** Copy an authenticated customer asset to a new public-delivery asset for CMS publication. */
export async function copyAuthenticatedVideoToPublic(input: { sourcePublicId: string; targetPublicId: string }): Promise<{
  publicId: string;
  bytes: number;
  durationSec?: number;
  format: string;
}> {
  const parsed = z.object({ sourcePublicId: publicIdSchema, targetPublicId: publicIdSchema }).strict().parse(input);
  if (cloudinaryTestMode()) return { publicId: parsed.targetPublicId, bytes: 1_000, durationSec: 10, format: "mp4" };
  const sourceUrl = createAuthenticatedVideoPreviewUrl({ publicId: parsed.sourcePublicId });
  cloudinaryConfig();
  const result = await cloudinary.uploader.upload(sourceUrl, {
    resource_type: "video",
    type: "upload",
    public_id: parsed.targetPublicId,
    overwrite: false,
    unique_filename: false,
    use_filename: false,
    invalidate: true,
  });
  return {
    publicId: result.public_id,
    bytes: result.bytes ?? 0,
    ...(result.duration !== undefined ? { durationSec: result.duration } : {}),
    format: result.format,
  };
}
