"use server";

import { revalidatePath } from "next/cache";

import { err, ok, type Result } from "@/lib/result";
import { favouriteEntitySchema } from "@/lib/schemas/favourites";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";

async function publishedEntityExists(entityType: "package" | "experience" | "activity", entityId: string): Promise<boolean> {
  if (entityType === "package") return Boolean(await db.package.findFirst({ where: { id: entityId, status: "PUBLISHED", deletedAt: null }, select: { id: true } }));
  if (entityType === "experience") return Boolean(await db.experience.findFirst({ where: { id: entityId, status: "PUBLISHED", deletedAt: null }, select: { id: true } }));
  return Boolean(await db.activity.findFirst({ where: { id: entityId, status: "PUBLISHED", deletedAt: null }, select: { id: true } }));
}

export async function toggleFavouriteAction(rawInput: unknown): Promise<Result<{ saved: boolean }>> {
  const parsed = favouriteEntitySchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "This favourite could not be saved.");
  // Unlike requireUser, getSession lets the public button return a sign-up prompt for guests.
  const session = await getSession();
  if (!session) return err("UNAUTHENTICATED", "Create an account to save favourites.");
  if (!(await publishedEntityExists(parsed.data.entityType, parsed.data.entityId))) return err("NOT_FOUND", "This item is no longer available.");

  try {
    const existing = await db.favourite.findUnique({ where: { userId_entityType_entityId: { userId: session.user.id, entityType: parsed.data.entityType, entityId: parsed.data.entityId } } });
    if (existing) {
      await db.favourite.delete({ where: { userId_entityType_entityId: { userId: session.user.id, entityType: parsed.data.entityType, entityId: parsed.data.entityId } } });
      revalidatePath("/account/favourites");
      return ok({ saved: false });
    }
    await db.favourite.create({ data: { userId: session.user.id, entityType: parsed.data.entityType, entityId: parsed.data.entityId } });
    revalidatePath("/account/favourites");
    return ok({ saved: true });
  } catch {
    return err("CONFLICT", "This favourite could not be updated. Please try again.");
  }
}
