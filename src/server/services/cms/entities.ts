import "server-only";

import type { PublishStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";

import type { CmsEntityType } from "./types";

export async function getCmsEntity(entityType: CmsEntityType, id: string) {
  if (entityType === "package") return db.package.findUnique({ where: { id } });
  return db.accommodation.findUnique({ where: { id } });
}

export async function updateCmsEntityStatus(input: {
  entityType: CmsEntityType;
  id: string;
  status: PublishStatus;
  publishAt: Date | null;
}) {
  const data = {
    status: input.status,
    ...(input.entityType === "package" ? { publishAt: input.status === "SCHEDULED" ? input.publishAt : null } : {}),
  };
  if (input.entityType === "package") {
    return db.package.update({ where: { id: input.id }, data });
  }
  return db.accommodation.update({ where: { id: input.id }, data: { status: input.status, publishAt: input.status === "SCHEDULED" ? input.publishAt : null } });
}

export async function softDeleteCmsEntity(entityType: CmsEntityType, id: string) {
  if (entityType === "package") return db.package.update({ where: { id }, data: { deletedAt: new Date() } });
  return db.accommodation.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function restoreCmsEntity(entityType: CmsEntityType, id: string) {
  if (entityType === "package") return db.package.update({ where: { id }, data: { deletedAt: null } });
  return db.accommodation.update({ where: { id }, data: { deletedAt: null } });
}

export async function reorderCmsEntity(entityType: CmsEntityType, id: string, direction: "up" | "down") {
  return db.$transaction(async (transaction) => {
    const records = entityType === "package"
      ? await transaction.package.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, sortOrder: true } })
      : await transaction.accommodation.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, sortOrder: true } });
    const index = records.findIndex((record) => record.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const current = records.at(index);
    const target = records.at(targetIndex);
    if (!current || !target) return { moved: false, from: current?.sortOrder ?? null, to: current?.sortOrder ?? null };

    if (entityType === "package") {
      await transaction.package.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } });
      await transaction.package.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } });
    } else {
      await transaction.accommodation.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } });
      await transaction.accommodation.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } });
    }
    return { moved: true, from: current.sortOrder, to: target.sortOrder, swappedId: target.id };
  }, { isolationLevel: "Serializable" });
}

