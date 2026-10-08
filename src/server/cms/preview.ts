import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { CMS_PREVIEW_TTL_SECONDS, type CmsContentType } from "@/config/cms-content";
import { env } from "@/config/env";
import { previewRequestSchema } from "@/lib/schemas/cms/content";

type PreviewPayload = { entityType: CmsContentType; id: string; exp: number };

function secret(): string {
  if (!env.PREVIEW_SECRET) throw new Error("PREVIEW_SECRET is not configured.");
  return env.PREVIEW_SECRET;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPreviewToken(input: unknown, now = Date.now()): string {
  const parsed = previewRequestSchema.parse(input);
  const encoded = Buffer.from(JSON.stringify({ ...parsed, exp: Math.floor(now / 1000) + CMS_PREVIEW_TTL_SECONDS })).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyPreviewToken(token: string, now = Date.now()): PreviewPayload | null {
  if (token.length > 2048) return null;
  const [encoded, provided, ...rest] = token.split(".");
  if (!encoded || !provided || rest.length) return null;
  let expected: string;
  try { expected = signature(encoded); } catch { return null; }
  const actualBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (!payload || typeof payload !== "object") return null;
    const value = payload as Record<string, unknown>;
    const checked = previewRequestSchema.safeParse({ entityType: value.entityType, id: value.id });
    if (!checked.success || typeof value.exp !== "number" || !Number.isInteger(value.exp) || value.exp <= Math.floor(now / 1000)) return null;
    return { ...checked.data, exp: value.exp };
  } catch { return null; }
}
