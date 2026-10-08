import type { MediaKind, MediaOrigin } from "@/generated/prisma/client";

export const CUSTOMER_UPLOAD_RATE_LIMIT = {
  max: 5,
  windowSeconds: 60 * 60,
} as const;

export const CLOUDINARY_WEBHOOK_TIMESTAMP_WINDOW_SECONDS = 5 * 60;
export const CLOUDINARY_WEBHOOK_MAX_BODY_BYTES = 256_000;
export const MEDIA_API_MAX_REQUEST_BYTES = 4_096;
export const MEDIA_FILE_METADATA_TIMEOUT_MS = 15_000;

export type MediaPurpose = "customer_video" | "admin_image" | "admin_video";

type MediaPurposePolicy = {
  kind: MediaKind;
  origin: MediaOrigin;
  resourceType: "image" | "video";
  folder: (userId: string) => string;
  presetEnv: "CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO" | "CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE" | "CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO";
  formats: readonly string[];
  maxBytes: number;
  maxDurationSeconds?: number;
  deliveryType: "upload" | "authenticated";
  eagerTransformations: readonly string[];
};

export const MEDIA_PURPOSES: Record<MediaPurpose, MediaPurposePolicy> = {
  customer_video: {
    kind: "VIDEO",
    origin: "CUSTOMER",
    resourceType: "video",
    folder: (userId: string) => `customers/${userId}/videos`,
    presetEnv: "CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO",
    formats: ["mp4", "mov", "webm"],
    maxBytes: 100_000_000,
    maxDurationSeconds: 90,
    deliveryType: "authenticated",
    eagerTransformations: ["f_mp4,vc_h264", "so_0,f_jpg"],
  },
  admin_image: {
    kind: "IMAGE",
    origin: "ADMIN",
    resourceType: "image",
    folder: (userId: string) => `admin/media/images/${userId}`,
    presetEnv: "CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE",
    formats: ["jpg", "png", "webp", "avif"],
    maxBytes: 10_000_000,
    deliveryType: "upload",
    eagerTransformations: [],
  },
  admin_video: {
    kind: "VIDEO",
    origin: "ADMIN",
    resourceType: "video",
    folder: (userId: string) => `admin/media/videos/${userId}`,
    presetEnv: "CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO",
    formats: ["mp4", "webm"],
    maxBytes: 100_000_000,
    maxDurationSeconds: 120,
    deliveryType: "upload",
    eagerTransformations: ["f_mp4,vc_h264", "so_0,f_jpg"],
  },
};

export const MEDIA_PURPOSE_KEYS = Object.keys(MEDIA_PURPOSES) as [MediaPurpose, ...MediaPurpose[]];

export function mediaPolicy(purpose: MediaPurpose): MediaPurposePolicy {
  switch (purpose) {
    case "customer_video": return MEDIA_PURPOSES.customer_video;
    case "admin_image": return MEDIA_PURPOSES.admin_image;
    case "admin_video": return MEDIA_PURPOSES.admin_video;
  }
}

export function formatMediaBytes(bytes: number): string {
  return bytes >= 1_000_000 ? `${bytes / 1_000_000} MB` : `${bytes / 1_000} KB`;
}
