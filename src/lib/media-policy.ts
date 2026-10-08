import { mediaPolicy, type MediaPurpose } from "@/config/media";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CloudinaryUploadParams = {
  timestamp: number;
  folder: string;
  public_id: string;
  upload_preset: string;
  allowed_formats: string;
  type: string;
  overwrite: boolean;
  use_filename: boolean;
  unique_filename: boolean;
  notification_url: string;
  eager?: string;
  eager_async?: boolean;
  eager_notification_url?: string;
};

export function buildCloudinaryUploadParams(input: {
  purpose: MediaPurpose;
  userId: string;
  assetId: string;
  timestamp: number;
  uploadPreset: string;
  notificationUrl: string;
}): CloudinaryUploadParams | null {
  if (!uuidPattern.test(input.userId) || !uuidPattern.test(input.assetId)) return null;
  const policy = mediaPolicy(input.purpose);
  const folder = policy.folder(input.userId);
  const params: CloudinaryUploadParams = {
    timestamp: input.timestamp,
    folder,
    public_id: input.assetId,
    upload_preset: input.uploadPreset,
    allowed_formats: policy.formats.join(","),
    type: policy.deliveryType,
    overwrite: false,
    use_filename: false,
    unique_filename: false,
    notification_url: input.notificationUrl,
  };
  if (policy.eagerTransformations.length) {
    params.eager = policy.eagerTransformations.join("|");
    params.eager_async = true;
    params.eager_notification_url = input.notificationUrl;
  }
  return params;
}

export function identifyMediaPurpose(publicId: string): { purpose: MediaPurpose; userId: string } | null {
  const parts = publicId.split("/");
  if (parts.length === 4 && parts[0] === "customers" && parts[2] === "videos" && uuidPattern.test(parts[1] ?? "") && uuidPattern.test(parts[3] ?? "")) {
    return { purpose: "customer_video", userId: parts[1] as string };
  }
  if (parts.length === 5 && parts[0] === "admin" && parts[1] === "media" && uuidPattern.test(parts[3] ?? "") && uuidPattern.test(parts[4] ?? "")) {
    if (parts[2] === "images") return { purpose: "admin_image", userId: parts[3] as string };
    if (parts[2] === "videos") return { purpose: "admin_video", userId: parts[3] as string };
  }
  return null;
}

export type CloudinaryAssetMetadata = {
  publicId: string;
  resourceType: string;
  format: string;
  bytes: number;
  duration?: number;
  folder?: string;
};

export function canDeleteMediaWithUsageCount(usageCount: number): boolean {
  return Number.isSafeInteger(usageCount) && usageCount === 0;
}

export function validateCloudinaryAssetMetadata(
  purpose: MediaPurpose,
  expectedUserId: string,
  asset: CloudinaryAssetMetadata,
): { valid: true; folder: string } | { valid: false; reason: string } {
  const policy = mediaPolicy(purpose);
  const folder = policy.folder(expectedUserId);
  const identified = identifyMediaPurpose(asset.publicId);
  if (!identified || identified.purpose !== purpose || identified.userId !== expectedUserId) {
    return { valid: false, reason: "Asset path is outside the authorized purpose folder." };
  }
  if (asset.resourceType !== policy.resourceType) {
    return { valid: false, reason: "Cloudinary resource type does not match the upload purpose." };
  }
  if (!policy.formats.includes(asset.format.toLowerCase())) {
    return { valid: false, reason: "Cloudinary detected a disallowed format." };
  }
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > policy.maxBytes) {
    return { valid: false, reason: "Asset size exceeds the purpose limit." };
  }
  if (policy.maxDurationSeconds !== undefined && (!Number.isFinite(asset.duration) || (asset.duration ?? 0) <= 0 || (asset.duration ?? 0) > policy.maxDurationSeconds)) {
    return { valid: false, reason: "Asset duration exceeds the purpose limit." };
  }
  if (asset.folder && asset.folder !== folder) {
    return { valid: false, reason: "Cloudinary asset folder does not match the signed folder." };
  }
  return { valid: true, folder };
}
