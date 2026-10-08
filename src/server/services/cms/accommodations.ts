import "server-only";

import { unstable_cache } from "next/cache";
import type { z } from "zod";

import { CMS_LIST_PAGE_SIZE } from "@/config/cms";
import { Prisma, type PublishStatus } from "@/generated/prisma/client";
import type { accommodationFormSchema } from "@/lib/schemas/cms/accommodation";
import { db } from "@/server/db";

export type AccommodationFormData = z.output<typeof accommodationFormSchema>;

export async function listAccommodations(input: {
  page: number;
  search: string;
  status?: PublishStatus;
  trash: boolean;
  sort: "sortOrder" | "updatedAt" | "status";
  direction: "asc" | "desc";
}) {
  const where: Prisma.AccommodationWhereInput = {
    deletedAt: input.trash ? { not: null } : null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { slug: { contains: input.search, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.accommodation.findMany({
      where,
      skip: (input.page - 1) * CMS_LIST_PAGE_SIZE,
      take: CMS_LIST_PAGE_SIZE,
      orderBy: [{ [input.sort]: input.direction }, { id: "asc" }],
      select: { id: true, slug: true, type: true, name: true, status: true, sortOrder: true, updatedAt: true, deletedAt: true },
    }),
    db.accommodation.count({ where }),
  ]);
  return { rows, total, page: input.page, pageSize: CMS_LIST_PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / CMS_LIST_PAGE_SIZE)) };
}

export async function getAccommodationForEditor(id: string) {
  return db.accommodation.findUnique({ where: { id } });
}

function nullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined || value === null ? Prisma.DbNull : value as Prisma.InputJsonValue;
}

export async function saveAccommodation(input: AccommodationFormData) {
  const { id, ...fields } = input;
  const data = {
    slug: fields.slug,
    type: fields.type,
    name: fields.name as Prisma.InputJsonValue,
    summary: nullableJson(fields.summary),
    description: nullableJson(fields.description),
    unitsTotal: fields.unitsTotal,
    maxGuests: fields.maxGuests,
    amenities: nullableJson(fields.amenities),
    heroMediaId: fields.heroMediaId,
    imageMediaIds: fields.imageMediaIds,
  } satisfies Prisma.AccommodationUncheckedCreateInput;
  return db.$transaction(async (transaction) => {
    const selectedMedia = [...new Set([fields.heroMediaId, ...fields.imageMediaIds].filter((mediaId): mediaId is string => Boolean(mediaId)))];
    const availableMedia = selectedMedia.length ? await transaction.media.findMany({
      where: { id: { in: selectedMedia }, kind: "IMAGE", origin: "ADMIN", isPublic: true, deletedAt: null },
      select: { id: true },
    }) : [];
    if (availableMedia.length !== selectedMedia.length) throw new Error("CMS_IMAGE_UNAVAILABLE");

    const record = id
      ? await transaction.accommodation.update({ where: { id }, data })
      : await transaction.accommodation.create({ data });

    await transaction.mediaUsage.deleteMany({ where: { entityType: "Accommodation", entityId: record.id, field: { in: ["hero", "gallery"] } } });
    const usages = [
      ...(fields.heroMediaId ? [{ mediaId: fields.heroMediaId, field: "hero" }] : []),
      ...fields.imageMediaIds.map((mediaId) => ({ mediaId, field: "gallery" })),
    ];
    if (usages.length) await transaction.mediaUsage.createMany({ data: usages.map((usage) => ({ ...usage, entityType: "Accommodation", entityId: record.id })) });
    return record;
  }, { isolationLevel: "Serializable" });
}

export async function getPublicAccommodationBySlug(slug: string) {
  return unstable_cache(
    async () => db.accommodation.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null } }),
    ["cms:accommodation", slug],
    { tags: ["cms:accommodations", `cms:accommodation:${slug}`], revalidate: 86_400 },
  )();
}

export async function getPublishedAccommodations() {
  return unstable_cache(
    async () => db.accommodation.findMany({ where: { status: "PUBLISHED", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
    ["cms:accommodations:list"],
    { tags: ["cms:accommodations"], revalidate: 86_400 },
  )();
}

