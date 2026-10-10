import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { CMS_PREVIEW_TTL_SECONDS } from "@/config/cms-content";
import { env } from "@/config/env";

type PagePreviewPayload = { pageId: string; exp: number };

function signature(payload: string): string {
  if (!env.PREVIEW_SECRET) throw new Error("PREVIEW_SECRET is not configured.");
  return createHmac("sha256", env.PREVIEW_SECRET).update(payload).digest("base64url");
}

export function createPagePreviewToken(pageId: string, now = Date.now()): string {
  const encoded = Buffer.from(JSON.stringify({ pageId, exp: Math.floor(now / 1000) + CMS_PREVIEW_TTL_SECONDS })).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyPagePreviewToken(token: string, now = Date.now()): PagePreviewPayload | null {
  if (token.length > 2_048) return null;
  const [encoded, supplied, ...extra] = token.split(".");
  if (!encoded || !supplied || extra.length) return null;
  let expected: string;
  try { expected = signature(encoded); } catch { return null; }
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof value.pageId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.pageId) || typeof value.exp !== "number" || value.exp <= Math.floor(now / 1000)) return null;
    return { pageId: value.pageId, exp: value.exp };
  } catch { return null; }
}
