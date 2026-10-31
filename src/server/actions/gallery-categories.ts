"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { err, ok, type Result } from "@/lib/result";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import {
  addGalleryCategory,
  deleteGalleryCategory,
  editGalleryCategory,
  getGalleryCategories,
} from "@/server/services/cms/gallery-categories";

async function categoryGate(key: string, permission: "cms.write" | "cms.delete" | "cms.read") {
  const requestHeaders = await headers();
  const firstForwardedIp = (
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-forwarded-for") ??
    "unknown"
  ).split(",")[0];
  const ip = (firstForwardedIp ?? "unknown")
    .trim()
    .slice(0, 128)
    .replace(/[^a-zA-Z0-9:._-]/g, "_");

  try {
    if (
      !(
        await limit(
          `cms-gallery-cat:${key}:ip:${ip}`,
          CMS_MUTATION_RATE_LIMIT.max,
          CMS_MUTATION_RATE_LIMIT.windowSeconds,
        )
      ).allowed
    ) {
      return {
        ok: false as const,
        error: err("RATE_LIMITED", "Too many requests. Try again later.") as Result<never>,
      };
    }
  } catch {
    return {
      ok: false as const,
      error: err("UNAVAILABLE", "CMS is temporarily unavailable.") as Result<never>,
    };
  }

  try {
    const staff = await requirePermission(permission);
    if (!("id" in staff))
      return {
        ok: false as const,
        error: err("FORBIDDEN", "Staff permission required.") as Result<never>,
      };
    return { ok: true as const, actorId: staff.id, requestHeaders };
  } catch (error) {
    const code =
      error instanceof AuthorizationError && error.code === "UNAUTHENTICATED"
        ? "UNAUTHENTICATED"
        : "FORBIDDEN";
    return {
      ok: false as const,
      error: err(
        code,
        code === "UNAUTHENTICATED" ? "Please sign in." : "You do not have permission.",
      ) as Result<never>,
    };
  }
}

export async function getGalleryCategoriesAction(): Promise<Result<{ categories: string[] }>> {
  const gate = await categoryGate("get", "cms.read");
  if (!gate.ok) return gate.error;
  const categories = await getGalleryCategories();
  return ok({ categories });
}

export async function addGalleryCategoryAction(raw: unknown): Promise<Result<{ categories: string[] }>> {
  const gate = await categoryGate("add", "cms.write");
  if (!gate.ok) return gate.error;

  const parsed = z.object({ name: z.string().trim().min(1, "Enter a category name.").max(50) }).safeParse(raw);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message || "Invalid category name.");

  const result = await addGalleryCategory(parsed.data.name, gate.actorId);
  if (!result.ok) return err("CONFLICT", result.message);

  const requestHeaders = await headers();
  await audit({
    actor: { id: gate.actorId, type: "STAFF" },
    action: "cms.gallery-category.create",
    entityType: "gallery-category",
    entityId: parsed.data.name,
    after: { name: parsed.data.name },
    ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return ok({ categories: result.categories });
}

export async function editGalleryCategoryAction(raw: unknown): Promise<Result<{ categories: string[] }>> {
  const gate = await categoryGate("edit", "cms.write");
  if (!gate.ok) return gate.error;

  const parsed = z
    .object({
      oldName: z.string().trim().min(1).max(50),
      newName: z.string().trim().min(1, "Enter a new category name.").max(50),
    })
    .safeParse(raw);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message || "Invalid category name.");

  const result = await editGalleryCategory(parsed.data.oldName, parsed.data.newName, gate.actorId);
  if (!result.ok) return err("CONFLICT", result.message);

  const requestHeaders = await headers();
  await audit({
    actor: { id: gate.actorId, type: "STAFF" },
    action: "cms.gallery-category.update",
    entityType: "gallery-category",
    entityId: parsed.data.newName,
    before: { name: parsed.data.oldName },
    after: { name: parsed.data.newName },
    ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return ok({ categories: result.categories });
}

export async function deleteGalleryCategoryAction(raw: unknown): Promise<Result<{ categories: string[] }>> {
  const gate = await categoryGate("delete", "cms.delete");
  if (!gate.ok) return gate.error;

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(50),
      reassignTo: z.string().trim().min(1).max(50).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid category delete request.");

  const result = await deleteGalleryCategory(parsed.data.name, parsed.data.reassignTo, gate.actorId);
  if (!result.ok) return err("CONFLICT", result.message);

  const requestHeaders = await headers();
  await audit({
    actor: { id: gate.actorId, type: "STAFF" },
    action: "cms.gallery-category.delete",
    entityType: "gallery-category",
    entityId: parsed.data.name,
    before: { name: parsed.data.name, reassignTo: parsed.data.reassignTo },
    ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return ok({ categories: result.categories });
}
