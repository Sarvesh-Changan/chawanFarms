"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { PAGE_BUILDER_CACHE_TAG } from "@/config/page-builder";
import { pageRevalidationPaths } from "@/lib/cms-page-policy";
import { err, ok, type Result } from "@/lib/result";
import { pageBuilderSchema, pagePreviewSchema, pageStatusSchema } from "@/lib/schemas/cms/pages";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { createPagePreviewToken } from "@/server/cms/page-preview";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { getPageForBuilder, savePageBuilder, setPageStatus } from "@/server/services/cms/pages";

type Gate = { actorId: string; ip?: string; userAgent?: string; requestId?: string };

async function gate(action: string, permission: "cms.read" | "cms.write" | "cms.publish"): Promise<Result<Gate>> {
  const requestHeaders = await headers();
  const ip = (requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim().slice(0, 128).replace(/[^a-zA-Z0-9:._-]/g, "_") ?? "unknown";
  try {
    if (!(await limit(`cms-page:${action}:ip:${ip}`, CMS_MUTATION_RATE_LIMIT.max, CMS_MUTATION_RATE_LIMIT.windowSeconds)).allowed) return err("RATE_LIMITED", "Too many requests. Try again shortly.");
  } catch { return err("UNAVAILABLE", "The CMS is temporarily unavailable."); }
  try {
    const staff = await requirePermission(permission);
    if (!("id" in staff)) return err("FORBIDDEN", "Staff permission required.");
    return ok({ actorId: staff.id, ip, userAgent: requestHeaders.get("user-agent")?.slice(0, 512), requestId: requestHeaders.get("x-request-id")?.slice(0, 128) ?? undefined });
  } catch (error) {
    return error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? err("UNAUTHENTICATED", "Please sign in.") : err("FORBIDDEN", "You do not have permission.");
  }
}

async function complete(input: { gate: Gate; action: string; id: string; before: unknown; after: unknown; slug?: string }) {
  const result = await audit({ actor: { id: input.gate.actorId, type: "STAFF" }, action: input.action, entityType: "Page", entityId: input.id, before: input.before, after: input.after, ip: input.gate.ip, userAgent: input.gate.userAgent, requestId: input.gate.requestId });
  revalidateTag(PAGE_BUILDER_CACHE_TAG, "max");
  revalidateTag("cms:all", "max");
  if (input.slug) revalidateTag(`cms:page:${input.slug}`, "max");
  if (input.slug) for (const path of pageRevalidationPaths(input.slug)) revalidatePath(path);
  else revalidatePath("/admin/cms/pages");
  return result;
}

export async function savePageBuilderAction(raw: unknown): Promise<Result<{ id: string }>> {
  const started = await gate("save", "cms.write");
  if (!started.ok) return started;
  const parsed = pageBuilderSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Please review the page sections.", parsed.error.flatten().fieldErrors);
  try {
    const saved = await savePageBuilder(parsed.data);
    const logged = await complete({ gate: started.data, action: "cms.page.update", id: parsed.data.id, before: saved.before, after: saved.after, slug: saved.after.slug });
    return logged.ok ? ok({ id: parsed.data.id }) : logged;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return err(message === "PAGE_MEDIA_UNAVAILABLE" ? "VALIDATION" : "CONFLICT", message === "PAGE_MEDIA_UNAVAILABLE" ? "Choose available public admin images." : "The page could not be saved.");
  }
}

export async function setPageStatusAction(raw: unknown): Promise<Result<{ id: string }>> {
  const started = await gate("status", "cms.write");
  if (!started.ok) return started;
  const parsed = pageStatusSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid page status.", parsed.error.flatten().fieldErrors);
  if (parsed.data.status === "PUBLISHED") {
    const publisher = await gate("publish", "cms.publish");
    if (!publisher.ok) return publisher;
  }
  try {
    const saved = await setPageStatus(parsed.data.id, parsed.data.status);
    const logged = await complete({ gate: started.data, action: `cms.page.status.${parsed.data.status.toLowerCase()}`, id: parsed.data.id, before: saved.before, after: saved.after, slug: saved.after.slug });
    return logged.ok ? ok({ id: parsed.data.id }) : logged;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return err(message === "PAGE_NEEDS_VISIBLE_SECTION" || message === "PAGE_INVALID_SECTIONS" || message === "PAGE_MEDIA_UNAVAILABLE" ? "VALIDATION" : "NOT_FOUND", "Page must contain valid, visible sections and available media before publishing.");
  }
}

export async function createPagePreviewAction(raw: unknown): Promise<Result<{ url: string }>> {
  const started = await gate("preview", "cms.read");
  if (!started.ok) return started;
  const parsed = pagePreviewSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid page preview request.", parsed.error.flatten().fieldErrors);
  const page = await getPageForBuilder(parsed.data.id);
  if (!page) return err("NOT_FOUND", "Page not found.");
  return ok({ url: `/preview/page/${createPagePreviewToken(page.id)}` });
}
