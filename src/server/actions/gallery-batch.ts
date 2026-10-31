"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { err, ok, type Result } from "@/lib/result";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { limit } from "@/server/integrations/ratelimit";
import { batchSaveGalleryItems } from "@/server/services/cms/gallery-batch";

const batchItemSchema = z.object({
  mediaId: z.string().uuid(),
  category: z.string().trim().min(1, "Choose a category.").max(80),
  caption: z.string().trim().max(500).optional(),
  isFeatured: z.boolean().optional(),
});

const batchCreateSchema = z.object({
  items: z.array(batchItemSchema).min(1, "Select at least one photo or video.").max(50),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export async function batchCreateGalleryItemsAction(
  raw: unknown,
): Promise<Result<{ count: number; ids: string[] }>> {
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
          `cms-gallery-batch:save:ip:${ip}`,
          CMS_MUTATION_RATE_LIMIT.max,
          CMS_MUTATION_RATE_LIMIT.windowSeconds,
        )
      ).allowed
    ) {
      return err("RATE_LIMITED", "Too many requests. Try again later.");
    }
  } catch {
    return err("UNAVAILABLE", "CMS is temporarily unavailable.");
  }

  let actorId: string;
  try {
    const staff = await requirePermission("cms.write");
    if (!("id" in staff)) return err("FORBIDDEN", "Staff permission required.");
    actorId = staff.id;
  } catch (error) {
    const code =
      error instanceof AuthorizationError && error.code === "UNAUTHENTICATED"
        ? "UNAUTHENTICATED"
        : "FORBIDDEN";
    return err(
      code,
      code === "UNAUTHENTICATED" ? "Please sign in." : "You do not have permission.",
    );
  }

  const parsed = batchCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return err("VALIDATION", "Invalid batch upload data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await batchSaveGalleryItems(
      parsed.data,
      actorId,
      {
        ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128),
        userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
        requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
      },
    );
    return ok(result);
  } catch (error) {
    return err(
      "CONFLICT",
      error instanceof Error ? error.message : "The gallery items could not be saved.",
    );
  }
}
