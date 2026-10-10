"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { SEO_CACHE_TAG } from "@/config/page-builder";
import { err, ok, type Result } from "@/lib/result";
import { seoMetadataSchema } from "@/lib/schemas/cms/seo";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { getSeoMetadata, saveSeoMetadata } from "@/server/services/cms/seo";

export async function saveSeoMetadataAction(raw: unknown): Promise<Result<{ id: string }>> {
  const requestHeaders = await headers();
  const ip = (requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim().slice(0, 128).replace(/[^a-zA-Z0-9:._-]/g, "_") ?? "unknown";
  try {
    if (!(await limit(`cms-seo:ip:${ip}`, CMS_MUTATION_RATE_LIMIT.max, CMS_MUTATION_RATE_LIMIT.windowSeconds)).allowed) return err("RATE_LIMITED", "Too many SEO changes. Try again shortly.");
  } catch { return err("UNAVAILABLE", "SEO settings are temporarily unavailable."); }
  let actorId: string;
  try {
    const staff = await requirePermission("seo.write");
    if (!("id" in staff)) return err("FORBIDDEN", "Staff permission required.");
    actorId = staff.id;
  } catch (error) {
    return error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? err("UNAUTHENTICATED", "Please sign in.") : err("FORBIDDEN", "You do not have permission.");
  }
  const parsed = seoMetadataSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Please review the SEO fields.", parsed.error.flatten().fieldErrors);
  const before = await getSeoMetadata(parsed.data.entityType, parsed.data.entityId, parsed.data.locale);
  try {
    const after = await saveSeoMetadata(parsed.data);
    const audited = await audit({ actor: { id: actorId, type: "STAFF" }, action: before ? "cms.seo.update" : "cms.seo.create", entityType: "SeoMetadata", entityId: after.id, before, after, ip, userAgent: requestHeaders.get("user-agent")?.slice(0, 512), requestId: requestHeaders.get("x-request-id")?.slice(0, 128) });
    revalidateTag(SEO_CACHE_TAG, "max");
    revalidateTag(`cms:seo:${parsed.data.entityType}:${parsed.data.entityId}`, "max");
    return audited.ok ? ok({ id: after.id }) : audited;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return err(message === "SEO_MEDIA_UNAVAILABLE" ? "VALIDATION" : "NOT_FOUND", message === "SEO_MEDIA_UNAVAILABLE" ? "Choose an available public image." : "The SEO record could not be saved.");
  }
}
