"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { err, type Result } from "@/lib/result";
import { requirePermission } from "@/server/authz";
import { audit } from "@/server/services/audit";
import { getMediaDetail, softDeleteMedia, updateMedia } from "@/server/services/media";

async function writeAudit(actorId: string, action: string, mediaId: string, before?: unknown, after?: unknown) {
  const requestHeaders = await headers();
  return audit({
    actor: { id: actorId, type: "STAFF" },
    action,
    entityType: "Media",
    entityId: mediaId,
    before,
    after,
    ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });
}

function authError(): Result<never> {
  return err("FORBIDDEN", "Media permission required.");
}

export async function updateMediaAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  let actorId: string;
  try {
    const principal = await requirePermission("media.write");
    if (!("id" in principal)) return authError();
    actorId = principal.id;
  } catch {
    return authError();
  }
  const id = z.object({ id: z.string().uuid() }).passthrough().safeParse(rawInput);
  if (!id.success) return err("VALIDATION", "Invalid media details.");
  const before = await getMediaDetail(id.data.id);
  const result = await updateMedia(rawInput);
  if (!result.ok) return result;
  const auditResult = await writeAudit(actorId, "media.update", id.data.id, before, { updated: true });
  if (!auditResult.ok) return auditResult;
  revalidatePath("/admin/media");
  return result;
}

export async function softDeleteMediaAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  let actorId: string;
  try {
    const principal = await requirePermission("media.delete");
    if (!("id" in principal)) return authError();
    actorId = principal.id;
  } catch {
    return authError();
  }
  const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid media ID.");
  const before = await getMediaDetail(parsed.data.id);
  const result = await softDeleteMedia(parsed.data.id);
  if (!result.ok) return result;
  const auditResult = await writeAudit(actorId, "media.soft_delete", parsed.data.id, before, { deletedAt: new Date().toISOString(), isPublic: false });
  if (!auditResult.ok) return auditResult;
  revalidatePath("/admin/media");
  return result;
}
