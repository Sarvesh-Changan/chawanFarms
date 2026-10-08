import type { CmsListRow } from "@/lib/types/cms";

export function toCmsListRow(input: {
  id: string;
  slug: string;
  name: unknown;
  status: string;
  sortOrder: number;
  updatedAt: Date;
}): CmsListRow {
  let label = input.slug;
  if (input.name && typeof input.name === "object" && !Array.isArray(input.name) && "en" in input.name) {
    const english = input.name.en;
    if (typeof english === "string" && english.trim()) label = english;
  }
  return { id: input.id, slug: input.slug, label, status: input.status, sortOrder: input.sortOrder, updatedAt: input.updatedAt.toISOString() };
}
