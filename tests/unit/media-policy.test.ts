import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it } from "vitest";

import { MEDIA_PURPOSES } from "../../src/config/media";
import { verifyCloudinaryWebhookSignature } from "../../src/lib/cloudinary-webhook-signature";
import { buildCloudinaryUploadParams, canDeleteMediaWithUsageCount, validateCloudinaryAssetMetadata } from "../../src/lib/media-policy";
import { updateMediaInputSchema } from "../../src/lib/schemas/media";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const assetId = "123e4567-e89b-42d3-a456-426614174001";

describe("media policy", () => {
  it("scopes signed parameters to a generated purpose folder and matching preset", () => {
    const signed = buildCloudinaryUploadParams({
      purpose: "customer_video",
      userId,
      assetId,
      timestamp: 1_800_000_000,
      uploadPreset: "customer-video",
      notificationUrl: "https://farms.example/api/webhooks/cloudinary",
    });

    expect(signed).toMatchObject({
      folder: `customers/${userId}/videos`,
      public_id: assetId,
      upload_preset: "customer-video",
      allowed_formats: "mp4,mov,webm",
      type: "authenticated",
      eager: "f_mp4,vc_h264|so_0,f_jpg",
      eager_async: true,
    });
    const signature = cloudinary.utils.api_sign_request(signed ?? {}, "test-signing-secret");
    expect(cloudinary.utils.api_sign_request({ ...(signed ?? {}), folder: `customers/${userId}/other` }, "test-signing-secret")).not.toBe(signature);
    expect(buildCloudinaryUploadParams({
      purpose: "admin_image", userId, assetId, timestamp: 1,
      uploadPreset: "admin-image", notificationUrl: "https://farms.example/hook",
    })?.folder).toBe(`admin/media/images/${userId}`);
  });

  it("rejects oversize, wrong-format and out-of-folder assets server-side", () => {
    const base = { publicId: `customers/${userId}/videos/${assetId}`, resourceType: "video", format: "mp4", bytes: 1_000, duration: 40, folder: `customers/${userId}/videos` };
    expect(validateCloudinaryAssetMetadata("customer_video", userId, { ...base, bytes: MEDIA_PURPOSES.customer_video.maxBytes + 1 }).valid).toBe(false);
    expect(validateCloudinaryAssetMetadata("customer_video", userId, { ...base, format: "avi" }).valid).toBe(false);
    expect(validateCloudinaryAssetMetadata("customer_video", userId, { ...base, publicId: `admin/media/videos/${userId}/${assetId}` }).valid).toBe(false);
  });

  it("requires English alt text before publishing an image", () => {
    const common = { id: assetId, kind: "IMAGE", altText: { mr: "चित्र" }, caption: {}, focalX: null, focalY: null, tags: [], category: null };
    expect(updateMediaInputSchema.safeParse({ ...common, isPublic: true }).success).toBe(false);
    expect(updateMediaInputSchema.safeParse({ ...common, altText: { en: "Farm garden", mr: "शेत" }, isPublic: false }).success).toBe(true);
  });

  it("rejects forged or stale Cloudinary webhooks", () => {
    const body = JSON.stringify({ notification_type: "upload", public_id: `customers/${userId}/videos/${assetId}` });
    const secret = "unit-test-cloudinary-secret";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = cloudinary.utils.webhook_signature(body, Number(timestamp), { api_secret: secret, signature_algorithm: "sha1" });
    expect(verifyCloudinaryWebhookSignature({ body, timestamp, signature, apiSecret: secret })).toBe(true);
    expect(verifyCloudinaryWebhookSignature({ body, timestamp, signature: "0".repeat(40), apiSecret: secret })).toBe(false);
    expect(verifyCloudinaryWebhookSignature({ body, timestamp: "1", signature, apiSecret: secret })).toBe(false);
  });

  it("blocks deletion while any usage is recorded", () => {
    expect(canDeleteMediaWithUsageCount(1)).toBe(false);
    expect(canDeleteMediaWithUsageCount(0)).toBe(true);
  });
});
