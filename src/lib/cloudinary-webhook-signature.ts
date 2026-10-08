import { timingSafeEqual } from "node:crypto";

import { v2 as cloudinary } from "cloudinary";

import { CLOUDINARY_WEBHOOK_TIMESTAMP_WINDOW_SECONDS } from "@/config/media";

export function verifyCloudinaryWebhookSignature(input: {
  body: string;
  timestamp: string;
  signature: string;
  apiSecret: string;
  nowMilliseconds?: number;
}): boolean {
  if (!/^\d{1,12}$/.test(input.timestamp) || !/^[a-f\d]{40}$/i.test(input.signature) || !input.apiSecret) return false;
  const timestamp = Number(input.timestamp);
  const nowSeconds = Math.floor((input.nowMilliseconds ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestamp) > CLOUDINARY_WEBHOOK_TIMESTAMP_WINDOW_SECONDS) return false;
  const expected = cloudinary.utils.webhook_signature(input.body, timestamp, {
    api_secret: input.apiSecret,
    signature_algorithm: "sha1",
  });
  const actualBuffer = Buffer.from(input.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
