"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { err, ok, type Result } from "@/lib/result";
import { storyFormSchema, storyListSchema, storyReferenceSchema, storyReorderSchema, storyStatusSchema } from "@/lib/schemas/cms/stories";
import { requirePermission, requireStaff } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { getStoryAdmin, listStoriesAdmin, reorderStory, restoreStory, saveStory, setStoryStatus, softDeleteStory } from "@/server/services/cms/stories";

async function gate(key: string, permission: "cms.read" | "cms.write" | "cms.publish" | "cms.delete") {
  const requestHeaders = await headers();
  const rawIp = requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? "unknown";
  const ip = rawIp.split(",")[0]?.trim().replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 128) || "unknown";
  try {
    if (!(await limit(`stories:${key}:ip:${ip}`, CMS_MUTATION_RATE_LIMIT.max, CMS_MUTATION_RATE_LIMIT.windowSeconds)).allowed) return { ok: false as const, error: err("RATE_LIMITED", "Too many requests. Try again later.") as Result<never> };
    const staff = await requireStaff();
    await requirePermission(permission);
    return { ok: true as const, actorId: staff.id, requestHeaders };
  } catch (error) {
    const code = error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN";
    return { ok: false as const, error: err(code, code === "UNAUTHENTICATED" ? "Please sign in." : "You do not have permission.") as Result<never> };
  }
}

async function record(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
  const requestHeaders = await headers();
  const result = await audit({ actor: { id: actorId, type: "STAFF" }, action, entityType: "Post", entityId, before, after, ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128), userAgent: requestHeaders.get("user-agent")?.slice(0, 512), requestId: requestHeaders.get("x-request-id")?.slice(0, 128) });
  revalidateTag("cms:post", "max");
  revalidateTag("cms:all", "max");
  revalidatePath("/"); revalidatePath("/stories"); revalidatePath("/sitemap.xml"); revalidatePath("/admin/stories");
  return result;
}

export async function listStoriesAction(raw: unknown) {
  const gateResult = await gate("list", "cms.read");
  if (!gateResult.ok) return gateResult.error;
  const parsed = storyListSchema.safeParse(raw ?? {});
  if (!parsed.success) return err("VALIDATION", "Invalid story filters.", parsed.error.flatten().fieldErrors);
  return ok(await listStoriesAdmin(parsed.data));
}

export async function getStoryAction(raw: unknown) {
  const gateResult = await gate("get", "cms.read");
  if (!gateResult.ok) return gateResult.error;
  const parsed = storyReferenceSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid story reference.");
  const story = await getStoryAdmin(parsed.data.id);
  return story ? ok(story) : err("NOT_FOUND", "Story not found.");
}

export async function saveStoryAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gateResult = await gate("save", "cms.write");
  if (!gateResult.ok) return gateResult.error;
  const parsed = storyFormSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Please review the story fields.", parsed.error.flatten().fieldErrors);
  try {
    const before = parsed.data.id ? await getStoryAdmin(parsed.data.id) : null;
    const result = await saveStory(parsed.data, gateResult.actorId);
    const auditResult = await record(gateResult.actorId, before ? "cms.story.update" : "cms.story.create", result.saved.id, before, result.saved);
    return auditResult.ok ? ok({ id: result.saved.id }) : auditResult;
  } catch (error) {
    if (error instanceof Error && error.message === "STORY_MEDIA_UNAVAILABLE") return err("CONFLICT", "Choose available uploaded media and save again.");
    if (error instanceof Error && error.message.includes("Unique constraint")) return err("CONFLICT", "That story slug is already in use.");
    return err("CONFLICT", "The story could not be saved.");
  }
}

export async function setStoryStatusAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gateResult = await gate("status", "cms.publish");
  if (!gateResult.ok) return gateResult.error;
  const parsed = storyStatusSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid story status.", parsed.error.flatten().fieldErrors);
  try {
    const before = await getStoryAdmin(parsed.data.id);
    if (!before) return err("NOT_FOUND", "Story not found.");
    const after = await setStoryStatus(parsed.data.id, parsed.data.status, parsed.data.publishAt ? new Date(parsed.data.publishAt) : null);
    const result = await record(gateResult.actorId, `cms.story.status.${parsed.data.status.toLowerCase()}`, parsed.data.id, before, after);
    return result.ok ? ok({ id: parsed.data.id }) : result;
  } catch (error) {
    const message = error instanceof Error && error.message === "STORY_GUEST_CONSENT_REQUIRED" ? "A guest story needs an approved submission with publish consent." : error instanceof Error && error.message === "STORY_VIDEO_UNAVAILABLE" ? "The story video is not available." : "The story status could not be changed.";
    return err("CONFLICT", message);
  }
}

export async function deleteStoryAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gateResult = await gate("delete", "cms.delete");
  if (!gateResult.ok) return gateResult.error;
  const parsed = storyReferenceSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid story reference.");
  const before = await getStoryAdmin(parsed.data.id);
  try {
    const after = await softDeleteStory(parsed.data.id);
    if (!after) return err("NOT_FOUND", "Story not found.");
    const result = await record(gateResult.actorId, "cms.story.trash", parsed.data.id, before, after);
    return result.ok ? ok({ id: parsed.data.id }) : result;
  } catch { return err("CONFLICT", "The story could not be moved to trash."); }
}

export async function restoreStoryAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gateResult = await gate("restore", "cms.write");
  if (!gateResult.ok) return gateResult.error;
  const parsed = storyReferenceSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid story reference.");
  try {
    const before = await getStoryAdmin(parsed.data.id);
    const after = await restoreStory(parsed.data.id);
    const result = await record(gateResult.actorId, "cms.story.restore", parsed.data.id, before, after);
    return result.ok ? ok({ id: parsed.data.id }) : result;
  } catch { return err("NOT_FOUND", "Trashed story not found."); }
}

export async function reorderStoryAction(raw: unknown): Promise<Result<{ id: string }>> {
  const gateResult = await gate("reorder", "cms.write");
  if (!gateResult.ok) return gateResult.error;
  const parsed = storyReorderSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid story reorder request.");
  const before = await getStoryAdmin(parsed.data.id);
  try {
    const changed = await reorderStory(parsed.data.id, parsed.data.direction);
    if (!changed.moved) return err("CONFLICT", "This story cannot move further in the list.");
    const after = await getStoryAdmin(parsed.data.id);
    const result = await record(gateResult.actorId, "cms.story.reorder", parsed.data.id, before, { story: after, direction: parsed.data.direction });
    return result.ok ? ok({ id: parsed.data.id }) : result;
  } catch { return err("CONFLICT", "Story order could not be changed."); }
}

