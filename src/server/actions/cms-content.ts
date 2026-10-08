"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { CMS_PREVIEW_TTL_SECONDS, type CmsContentType } from "@/config/cms-content";
import { err, ok, type Result } from "@/lib/result";
import { cmsContentFormSchema, cmsContentReorderSchema, cmsContentStatusSchema, cmsContentReferenceSchema, previewRequestSchema } from "@/lib/schemas/cms/content";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { createPreviewToken } from "@/server/cms/preview";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { getCmsContent, listCmsContent, reorderGalleryItems, restoreCmsContent, saveCmsContent, setCmsContentStatus, softDeleteCmsContent } from "@/server/services/cms/content";

async function mutationGate(key: string, permission: "cms.write" | "cms.publish" | "cms.delete" | "cms.read") {
  const requestHeaders = await headers();
  const firstForwardedIp = (requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? "unknown").split(",")[0];
  const ip = (firstForwardedIp ?? "unknown").trim().slice(0, 128).replace(/[^a-zA-Z0-9:._-]/g, "_");
  try { if (!(await limit(`cms-content:${key}:ip:${ip}`, CMS_MUTATION_RATE_LIMIT.max, CMS_MUTATION_RATE_LIMIT.windowSeconds)).allowed) return { ok: false as const, error: err("RATE_LIMITED", "Too many requests. Try again later.") as Result<never> }; }
  catch { return { ok: false as const, error: err("UNAVAILABLE", "CMS is temporarily unavailable.") as Result<never> }; }
  try {
    const staff = await requirePermission(permission);
    if (!("id" in staff)) return { ok: false as const, error: err("FORBIDDEN", "Staff permission required.") as Result<never> };
    return { ok: true as const, actorId: staff.id, requestHeaders };
  } catch (error) {
    const code = error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN";
    return { ok: false as const, error: err(code, code === "UNAUTHENTICATED" ? "Please sign in." : "You do not have permission.") as Result<never> };
  }
}

function cmsPath(type: CmsContentType): string {
  switch (type) {
    case "activity": return "activities"; case "experience": return "experiences";
    case "menu-category": return "menu-categories"; case "menu-item": return "menu-items";
    case "faq": return "faqs"; case "offer": return "offers"; case "testimonial": return "testimonials";
    case "gallery-item": return "gallery"; case "post": return "stories"; case "post-category": return "story-categories";
  }
}

async function record(actorId: string, action: string, type: CmsContentType, id: string, before: unknown, after: unknown) {
  const requestHeaders = await headers();
  const result = await audit({ actor: { id: actorId, type: "STAFF" }, action, entityType: type, entityId: id, before, after, ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128), userAgent: requestHeaders.get("user-agent")?.slice(0, 512), requestId: requestHeaders.get("x-request-id")?.slice(0, 128) });
  revalidateTag(`cms:${type}`, "max");
  revalidateTag("cms:all", "max");
  revalidatePath("/admin/cms");
  revalidatePath(`/admin/cms/${cmsPath(type)}`);
  return result;
}

export async function listCmsContentAction(raw: unknown) {
  const gate = await mutationGate("list", "cms.read");
  if (!gate.ok) return gate.error;
  const parsed = (await import("@/lib/schemas/cms/content")).cmsContentListQuerySchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid list filters.", parsed.error.flatten().fieldErrors);
  return ok(await listCmsContent({ entityType: parsed.data.entityType, page: parsed.data.page, q: parsed.data.q, status: parsed.data.status, trash: parsed.data.trash }));
}

export async function saveCmsContentAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gate = await mutationGate("save", "cms.write");
  if (!gate.ok) return gate.error;
  const parsed = cmsContentFormSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Please review the content fields.", parsed.error.flatten().fieldErrors);
  try {
    const before = parsed.data.id ? await getCmsContent(parsed.data.entityType, parsed.data.id) : null;
    const saved = await saveCmsContent(parsed.data);
    const result = await record(gate.actorId, before ? `cms.${parsed.data.entityType}.update` : `cms.${parsed.data.entityType}.create`, parsed.data.entityType, saved.id, before, saved);
    return result.ok ? ok({ id: saved.id }) : result;
  } catch (error) {
    return err("CONFLICT", error instanceof Error && error.message === "CMS_MEDIA_UNAVAILABLE" ? "Choose available public admin media." : "The content could not be saved. Check required fields, references, or duplicate slugs.");
  }
}

export async function publishCmsContentAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gate = await mutationGate("publish", "cms.publish");
  if (!gate.ok) return gate.error;
  const parsed = cmsContentStatusSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid publish settings.", parsed.error.flatten().fieldErrors);
  try {
    const before = await getCmsContent(parsed.data.entityType, parsed.data.id);
    if (!before || (parsed.data.entityType === "post-category")) return err("NOT_FOUND", "Content not found.");
    if (parsed.data.entityType === "testimonial" && parsed.data.status === "PUBLISHED" && !("consentConfirmed" in before && before.consentConfirmed)) return err("FORBIDDEN", "Confirmed consent is required before publishing a testimonial.");
    const saved = await setCmsContentStatus(parsed.data.entityType, parsed.data.id, parsed.data.status, parsed.data.publishAt ? new Date(parsed.data.publishAt) : null);
    const result = await record(gate.actorId, `cms.${parsed.data.entityType}.publish.${parsed.data.status.toLowerCase()}`, parsed.data.entityType, saved.id, before, saved);
    return result.ok ? ok({ id: saved.id }) : result;
  } catch { return err("CONFLICT", "This content could not be published."); }
}

export async function deleteCmsContentAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gate = await mutationGate("delete", "cms.delete");
  if (!gate.ok) return gate.error;
  const parsed = cmsContentReferenceSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid content reference.");
  try {
    const before = await getCmsContent(parsed.data.entityType, parsed.data.id);
    const saved = await softDeleteCmsContent(parsed.data.entityType, parsed.data.id);
    if (!saved) return err("NOT_FOUND", "Content not found.");
    const result = await record(gate.actorId, `cms.${parsed.data.entityType}.trash`, parsed.data.entityType, parsed.data.id, before, saved);
    return result.ok ? ok({ id: parsed.data.id }) : result;
  } catch (error) { return err("CONFLICT", error instanceof Error && error.message === "CMS_REFERENCED" ? "This item is still in use and cannot be deleted." : "Content could not be moved to trash."); }
}

export async function restoreCmsContentAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gate = await mutationGate("restore", "cms.write");
  if (!gate.ok) return gate.error;
  const parsed = cmsContentReferenceSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid content reference.");
  try {
    const before = await getCmsContent(parsed.data.entityType, parsed.data.id);
    const saved = await restoreCmsContent(parsed.data.entityType, parsed.data.id);
    const result = await record(gate.actorId, `cms.${parsed.data.entityType}.restore`, parsed.data.entityType, parsed.data.id, before, saved);
    return result.ok ? ok({ id: parsed.data.id }) : result;
  } catch { return err("NOT_FOUND", "Trashed content not found."); }
}

export async function reorderGalleryItemAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gate = await mutationGate("gallery-reorder", "cms.write");
  if (!gate.ok) return gate.error;
  const parsed = cmsContentReorderSchema.safeParse({ ...(raw as object), entityType: "gallery-item" });
  if (!parsed.success) return err("VALIDATION", "Invalid gallery reorder request.");
  const before = await getCmsContent("gallery-item", parsed.data.id);
  try {
    const changed = await reorderGalleryItems(parsed.data.id, parsed.data.direction);
    if (!changed.moved) return err("CONFLICT", "This item cannot move further in its category.");
    const after = await getCmsContent("gallery-item", parsed.data.id);
    const result = await record(gate.actorId, "cms.gallery-item.reorder", "gallery-item", parsed.data.id, before, after);
    return result.ok ? ok({ id: parsed.data.id }) : result;
  } catch { return err("CONFLICT", "Gallery order could not be changed."); }
}

export async function createCmsPreviewAction(raw: unknown): Promise<Result<{ url: string; expiresIn: number }>> {
  const gate = await mutationGate("preview", "cms.read");
  if (!gate.ok) return gate.error;
  const parsed = previewRequestSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid preview request.");
  const item = await getCmsContent(parsed.data.entityType, parsed.data.id);
  if (!item || ("deletedAt" in item && item.deletedAt)) return err("NOT_FOUND", "Content not found.");
  try { return ok({ url: `/preview/${createPreviewToken(parsed.data)}`, expiresIn: CMS_PREVIEW_TTL_SECONDS }); }
  catch { return err("UNAVAILABLE", "Preview links are unavailable until PREVIEW_SECRET is configured."); }
}
