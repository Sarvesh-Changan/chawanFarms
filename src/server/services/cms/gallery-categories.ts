import "server-only";

import { GALLERY_CATEGORIES } from "@/config/gallery";
import { db } from "@/server/db";

const SETTING_KEY = "gallery.categories";

export async function getGalleryCategories(): Promise<string[]> {
  const row = await db.setting.findUnique({
    where: { key: SETTING_KEY },
    select: { value: true },
  });

  let saved: string[] = [];
  if (row?.value && Array.isArray(row.value)) {
    saved = row.value
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Also include any categories currently used in active gallery items so nothing is lost
  const usedRows = await db.galleryItem.findMany({
    where: { deletedAt: null },
    distinct: ["category"],
    select: { category: true },
  });
  const used = usedRows.map((r) => r.category.trim()).filter(Boolean);

  const initial = saved.length > 0 ? saved : Array.from(GALLERY_CATEGORIES);
  const combined = Array.from(new Set([...initial, ...used]));
  return combined.length > 0 ? combined : Array.from(GALLERY_CATEGORIES);
}

export async function addGalleryCategory(
  name: string,
  actorId?: string,
): Promise<{ ok: true; categories: string[] } | { ok: false; message: string }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 50) {
    return { ok: false, message: "Category name must be between 1 and 50 characters." };
  }

  const current = await getGalleryCategories();
  if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, message: `Category "${trimmed}" already exists.` };
  }

  const next = [...current, trimmed];
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: next, updatedById: actorId },
    update: { value: next, updatedById: actorId },
  });

  return { ok: true, categories: next };
}

export async function editGalleryCategory(
  oldName: string,
  newName: string,
  actorId?: string,
): Promise<{ ok: true; categories: string[] } | { ok: false; message: string }> {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();

  if (!trimmedNew || trimmedNew.length > 50) {
    return { ok: false, message: "Category name must be between 1 and 50 characters." };
  }

  const current = await getGalleryCategories();
  if (!current.some((c) => c.toLowerCase() === trimmedOld.toLowerCase())) {
    return { ok: false, message: `Category "${trimmedOld}" was not found.` };
  }

  if (
    trimmedOld.toLowerCase() !== trimmedNew.toLowerCase() &&
    current.some((c) => c.toLowerCase() === trimmedNew.toLowerCase())
  ) {
    return { ok: false, message: `A category named "${trimmedNew}" already exists.` };
  }

  const next = current.map((c) =>
    c.toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : c,
  );

  await db.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: next, updatedById: actorId },
      update: { value: next, updatedById: actorId },
    });
    await tx.galleryItem.updateMany({
      where: { category: trimmedOld },
      data: { category: trimmedNew },
    });
  });

  return { ok: true, categories: next };
}

export async function deleteGalleryCategory(
  name: string,
  reassignTo?: string,
  actorId?: string,
): Promise<{ ok: true; categories: string[] } | { ok: false; message: string }> {
  const trimmed = name.trim();
  const count = await db.galleryItem.count({
    where: { category: trimmed, deletedAt: null },
  });

  if (count > 0 && !reassignTo) {
    return {
      ok: false,
      message: `Cannot delete "${trimmed}" because ${count} gallery item(s) are using it. Please choose another category to reassign them to.`,
    };
  }

  const current = await getGalleryCategories();
  if (current.length <= 1) {
    return { ok: false, message: "At least one gallery category is required." };
  }

  const next = current.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());

  await db.$transaction(async (tx) => {
    if (count > 0 && reassignTo) {
      const target = reassignTo.trim();
      await tx.galleryItem.updateMany({
        where: { category: trimmed },
        data: { category: target },
      });
    }
    await tx.setting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: next, updatedById: actorId },
      update: { value: next, updatedById: actorId },
    });
  });

  return { ok: true, categories: next };
}
