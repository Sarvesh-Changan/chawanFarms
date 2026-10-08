import "server-only";

import { unstable_cache } from "next/cache";
import type { z } from "zod";

import { CMS_LIST_PAGE_SIZE } from "@/config/cms";
import { Prisma, type PublishStatus } from "@/generated/prisma/client";
import type { packageFormSchema, packageRateFormSchema } from "@/lib/schemas/cms/package";
import { db } from "@/server/db";

export type PackageFormData = z.output<typeof packageFormSchema>;
export type PackageRateFormData = z.output<typeof packageRateFormSchema>;

export async function listPackages(input: {
  page: number;
  search: string;
  status?: PublishStatus;
  trash: boolean;
  sort: "sortOrder" | "updatedAt" | "status";
  direction: "asc" | "desc";
}) {
  const where: Prisma.PackageWhereInput = {
    deletedAt: input.trash ? { not: null } : null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { OR: [
      { slug: { contains: input.search, mode: "insensitive" } },
      { code: { contains: input.search, mode: "insensitive" } },
    ] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.package.findMany({
      where,
      skip: (input.page - 1) * CMS_LIST_PAGE_SIZE,
      take: CMS_LIST_PAGE_SIZE,
      orderBy: [{ [input.sort]: input.direction }, { id: "asc" }],
      select: { id: true, slug: true, code: true, name: true, status: true, sortOrder: true, updatedAt: true, deletedAt: true },
    }),
    db.package.count({ where }),
  ]);
  return { rows, total, page: input.page, pageSize: CMS_LIST_PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / CMS_LIST_PAGE_SIZE)) };
}

export async function getPackageForEditor(id: string) {
  return db.package.findUnique({
    where: { id },
    include: {
      rates: { orderBy: [{ createdAt: "desc" }, { id: "asc" }] },
      accommodations: { select: { accommodationId: true } },
      activities: { select: { activityId: true } },
    },
  });
}

function nullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined || value === null ? Prisma.DbNull : value as Prisma.InputJsonValue;
}

export async function savePackage(input: PackageFormData) {
  const { id, accommodationIds, activityIds, ...fields } = input;
  const data = {
    slug: fields.slug,
    code: fields.code,
    name: fields.name as Prisma.InputJsonValue,
    summary: nullableJson(fields.summary),
    description: nullableJson(fields.description),
    inclusions: nullableJson(fields.inclusions),
    conditions: nullableJson(fields.conditions),
    minGuests: fields.minGuests,
    maxGuests: fields.maxGuests,
    timingNote: nullableJson(fields.timingNote),
    isDayVisit: fields.isDayVisit,
    isGroupOnly: fields.isGroupOnly,
    heroMediaId: fields.heroMediaId,
  } satisfies Prisma.PackageUncheckedCreateInput;

  return db.$transaction(async (transaction) => {
    if (fields.heroMediaId) {
      const media = await transaction.media.findFirst({ where: { id: fields.heroMediaId, kind: "IMAGE", origin: "ADMIN", isPublic: true, deletedAt: null }, select: { id: true } });
      if (!media) throw new Error("CMS_HERO_MEDIA_UNAVAILABLE");
    }
    const [accommodations, activities] = await Promise.all([
      accommodationIds.length ? transaction.accommodation.count({ where: { id: { in: accommodationIds }, deletedAt: null } }) : 0,
      activityIds.length ? transaction.activity.count({ where: { id: { in: activityIds }, deletedAt: null } }) : 0,
    ]);
    if (accommodations !== accommodationIds.length || activities !== activityIds.length) {
      throw new Error("CMS_RELATION_UNAVAILABLE");
    }
    const record = id
      ? await transaction.package.update({ where: { id }, data })
      : await transaction.package.create({ data });

    await transaction.packageAccommodation.deleteMany({ where: { packageId: record.id } });
    await transaction.packageActivity.deleteMany({ where: { packageId: record.id } });
    if (accommodationIds.length) {
      await transaction.packageAccommodation.createMany({ data: accommodationIds.map((accommodationId) => ({ packageId: record.id, accommodationId })) });
    }
    if (activityIds.length) {
      await transaction.packageActivity.createMany({ data: activityIds.map((activityId) => ({ packageId: record.id, activityId })) });
    }
    return record;
  }, { isolationLevel: "Serializable" });
}

export async function listPackageRelationOptions() {
  const [accommodations, activities] = await Promise.all([
    db.accommodation.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], select: { id: true, slug: true, name: true } }),
    db.activity.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], select: { id: true, slug: true, name: true } }),
  ]);
  return { accommodations, activities };
}

function dateAtUtcMidnight(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function createPackageRate(input: PackageRateFormData) {
  return db.$transaction(async (transaction) => {
    await transaction.packageRate.updateMany({
      where: { packageId: input.packageId, foodPreference: input.foodPreference, audience: input.audience, isActive: true },
      data: { isActive: false },
    });
    return transaction.packageRate.create({
      data: {
        packageId: input.packageId,
        foodPreference: input.foodPreference,
        audience: input.audience,
        unit: input.unit,
        amountPaise: input.amountPaise,
        percentOfAdult: input.percentOfAdult,
        validFrom: dateAtUtcMidnight(input.validFrom),
        validTo: dateAtUtcMidnight(input.validTo),
        seasonLabel: input.seasonLabel,
        meta: { source: "admin" },
      },
    });
  }, { isolationLevel: "Serializable" });
}

export async function deactivatePackageRate(id: string) {
  return db.packageRate.update({ where: { id }, data: { isActive: false } });
}

export async function getPublicPackageBySlug(slug: string) {
  return unstable_cache(
    async () => db.package.findFirst({
      where: { slug, status: "PUBLISHED", deletedAt: null },
      include: {
        rates: { where: { isActive: true }, orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }] },
        accommodations: { include: { accommodation: true } },
        activities: { include: { activity: true } },
      },
    }),
    ["cms:package", slug],
    { tags: ["cms:packages", `cms:package:${slug}`], revalidate: 86_400 },
  )();
}

export async function getPublishedPackages() {
  return unstable_cache(
    async () => db.package.findMany({ where: { status: "PUBLISHED", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], select: { id: true, slug: true, code: true, name: true, summary: true, status: true, rates: { where: { isActive: true }, select: { amountPaise: true, audience: true, foodPreference: true, unit: true } } } }),
    ["cms:packages:list"],
    { tags: ["cms:packages"], revalidate: 86_400 },
  )();
}

