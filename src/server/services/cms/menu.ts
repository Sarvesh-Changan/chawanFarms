import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { MenuCategoryFormData, MenuItemFormData } from "@/lib/schemas/cms/menu";
import { db } from "@/server/db";

function text(value: unknown): string { return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).en === "string" ? String((value as Record<string, unknown>).en) : ""; }
function slugify(value: string): string { return value.toLowerCase().normalize("NFKD").replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "menu-category"; }
function requiredJson(value: unknown): Prisma.InputJsonValue { return value as Prisma.InputJsonValue; }
function nullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput { return value === undefined ? Prisma.DbNull : value as Prisma.InputJsonValue; }

async function uniqueSlug(name: unknown, id?: string) {
  const base = slugify(text(name));
  let candidate = base; let suffix = 1;
  while (await db.menuCategory.findFirst({ where: { slug: candidate, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) candidate = `${base}-${suffix++}`;
  return candidate;
}

export async function getMenuAdmin(input: { q: string; trash: boolean }) {
  const deletedAt = input.trash ? { not: null } : null;
  const categories = await db.menuCategory.findMany({ where: { deletedAt, ...(input.q ? { name: { path: ["en"], string_contains: input.q, mode: "insensitive" } } : {}) }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { items: { where: { deletedAt, ...(input.q ? { OR: [{ name: { path: ["en"], string_contains: input.q, mode: "insensitive" } }, { description: { path: ["en"], string_contains: input.q, mode: "insensitive" } }] } : {}) }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
  const options = await db.menuCategory.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } });
  return { categories, options };
}

export async function getMenuCategory(id: string) { return db.menuCategory.findUnique({ where: { id }, include: { items: true } }); }
export async function getMenuItem(id: string) { return db.menuItem.findUnique({ where: { id } }); }

export async function saveMenuCategory(input: MenuCategoryFormData) {
  const slug = await uniqueSlug(input.name, input.id);
  return input.id ? db.menuCategory.update({ where: { id: input.id }, data: { name: requiredJson(input.name), slug, status: input.published ? "PUBLISHED" : "DRAFT", publishAt: null } }) : db.menuCategory.create({ data: { name: requiredJson(input.name), slug, status: input.published ? "PUBLISHED" : "DRAFT", publishAt: null } });
}

export async function saveMenuItem(input: MenuItemFormData) {
  const category = await db.menuCategory.findFirst({ where: { id: input.categoryId, deletedAt: null }, select: { id: true } });
  if (!category) throw new Error("MENU_CATEGORY_UNAVAILABLE");
  const data = { categoryId: input.categoryId, name: requiredJson(input.name), description: nullableJson(input.description), foodPreference: input.foodPreference === "BOTH" ? null : input.foodPreference, isExtraCharge: input.isExtraCharge, extraPricePaise: input.priceRupees ?? null, status: input.published ? "PUBLISHED" as const : "DRAFT" as const, isPublished: input.published, publishAt: null };
  return input.id ? db.menuItem.update({ where: { id: input.id }, data }) : db.menuItem.create({ data });
}

export async function setMenuPublished(entity: "category" | "item", id: string, published: boolean) {
  if (entity === "category") return db.menuCategory.update({ where: { id }, data: { status: published ? "PUBLISHED" : "DRAFT", publishAt: null } });
  return db.menuItem.update({ where: { id }, data: { status: published ? "PUBLISHED" : "DRAFT", isPublished: published, publishAt: null } });
}

export async function softDeleteMenu(entity: "category" | "item", id: string) {
  if (entity === "item") return db.menuItem.update({ where: { id }, data: { status: "ARCHIVED", isPublished: false, deletedAt: new Date() } });
  const count = await db.menuItem.count({ where: { categoryId: id, deletedAt: null } });
  if (count) throw new Error("MENU_CATEGORY_HAS_ITEMS");
  return db.menuCategory.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
}

export async function restoreMenu(entity: "category" | "item", id: string) {
  if (entity === "item") return db.menuItem.update({ where: { id }, data: { status: "DRAFT", isPublished: false, deletedAt: null } });
  return db.menuCategory.update({ where: { id }, data: { status: "DRAFT", deletedAt: null, publishAt: null } });
}

export async function reorderMenu(entity: "category" | "item", id: string, direction: "up" | "down") {
  return db.$transaction(async (tx) => {
    if (entity === "category") {
      const rows = await tx.menuCategory.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
      const index = rows.findIndex((row) => row.id === id); const target = index + (direction === "up" ? -1 : 1); if (index < 0 || target < 0 || target >= rows.length) return { moved: false };
      const reordered = [...rows]; const moving = reordered.splice(index, 1)[0]; if (!moving) return { moved: false }; reordered.splice(target, 0, moving); await Promise.all(reordered.map((row, sortOrder) => tx.menuCategory.update({ where: { id: row.id }, data: { sortOrder } }))); return { moved: true };
    }
    const item = await tx.menuItem.findFirst({ where: { id, deletedAt: null }, select: { categoryId: true } }); if (!item) return { moved: false };
    const rows = await tx.menuItem.findMany({ where: { categoryId: item.categoryId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
    const index = rows.findIndex((row) => row.id === id); const target = index + (direction === "up" ? -1 : 1); if (index < 0 || target < 0 || target >= rows.length) return { moved: false };
    const reordered = [...rows]; const moving = reordered.splice(index, 1)[0]; if (!moving) return { moved: false }; reordered.splice(target, 0, moving); await Promise.all(reordered.map((row, sortOrder) => tx.menuItem.update({ where: { id: row.id }, data: { sortOrder } }))); return { moved: true };
  }, { isolationLevel: "Serializable" });
}

export async function bulkPublishMenu(entity: "category" | "item", ids: string[], published: boolean) {
  if (entity === "category") return db.menuCategory.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { status: published ? "PUBLISHED" : "DRAFT", publishAt: null } });
  return db.menuItem.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { status: published ? "PUBLISHED" : "DRAFT", isPublished: published, publishAt: null } });
}
