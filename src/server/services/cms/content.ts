import "server-only";

import { unstable_cache } from "next/cache";

import { CMS_CONTENT_PAGE_SIZE, type CmsContentType } from "@/config/cms-content";
import { Prisma, type PublishStatus } from "@/generated/prisma/client";
import { publicCmsWhere } from "@/lib/cms-public-policy";
import { hasCmsReferences } from "@/lib/cms-reference-policy";
import type { CmsContentFormData } from "@/lib/schemas/cms/content";
import { sanitizeLocalizedHtml } from "@/server/cms/html";
import { db } from "@/server/db";
import { cleanupUnusedAdminMedia } from "@/server/services/media";

const statusWhere = (status?: PublishStatus) => status ? { status } : {};
const html = (value: unknown) => value ? sanitizeLocalizedHtml(value) : undefined;
function required<T>(value: T | undefined | null, field: string): T {
  if (value === undefined || value === null || value === "") throw new Error(`CMS_REQUIRED_${field}`);
  return value;
}
const nullableJson = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =>
  value === undefined ? Prisma.DbNull : value as Prisma.InputJsonValue;

function toRecord(input: CmsContentFormData) {
  const common = { status: input.id ? undefined : "DRAFT" as const, ...(input.entityType === "offer" ? {} : { publishAt: input.id ? undefined : null }) };
  switch (input.entityType) {
    case "activity": return { ...common, slug: required(input.slug, "SLUG"), name: required(input.name, "NAME"), summary: nullableJson(input.summary), description: nullableJson(html(input.description)), isExtraCost: input.isExtraCost ?? false, priceNote: nullableJson(input.priceNote), needsPriorNotice: input.needsPriorNotice ?? false, conditionsNote: nullableJson(input.conditionsNote), heroMediaId: input.heroMediaId || null };
    case "experience": return { ...common, slug: required(input.slug, "SLUG"), title: required(input.title, "TITLE"), summary: nullableJson(input.summary), body: nullableJson(html(input.body)), heroMediaId: input.heroMediaId || null };
    case "menu-category": return { ...common, slug: required(input.slug, "SLUG"), name: required(input.name, "NAME") };
    case "menu-item": return { ...common, name: required(input.name, "NAME"), categoryId: required(input.categoryId, "CATEGORY"), description: nullableJson(input.description), foodPreference: input.foodPreference || null, isExtraCharge: input.isExtraCharge ?? false, extraPricePaise: input.extraPriceRupees ?? null, extraUnitLabel: input.extraUnitLabel || null, isPublished: input.id ? undefined : false };
    case "faq": return { ...common, question: required(input.question, "QUESTION"), answer: nullableJson(html(required(input.answer, "ANSWER"))), groupKey: input.groupKey || null, isPublished: input.id ? undefined : false };
    case "offer": return { ...common, slug: required(input.slug, "SLUG"), title: required(input.title, "TITLE"), description: nullableJson(html(input.description)), discountType: input.discountType || null, discountValue: input.discountType === "FIXED" ? input.discountValueInput ? Math.round(Number(input.discountValueInput) * 100) : null : input.discountValueInput ? Number(input.discountValueInput) : null, startsAt: new Date(required(input.startsAt, "STARTS_AT")), endsAt: new Date(required(input.endsAt, "ENDS_AT")), packageIds: input.packageIds ?? [] };
    case "testimonial": return { ...common, authorName: required(input.authorName, "AUTHOR"), authorMeta: input.authorMeta || null, quote: required(input.quote, "QUOTE"), mediaId: input.mediaId || null, consentConfirmed: input.consentConfirmed ?? false };
    case "gallery-item": return { ...common, mediaId: required(input.mediaId, "MEDIA"), category: required(input.category, "CATEGORY"), caption: nullableJson(input.caption), isFeatured: input.isFeatured ?? false };
    case "post": return { ...common, slug: required(input.slug, "SLUG"), title: required(input.title, "TITLE"), excerpt: nullableJson(input.summary), body: nullableJson(html(required(input.body, "BODY"))), categoryId: input.categoryId || null, authorName: input.authorName || null, coverMediaId: input.coverMediaId || null };
    case "post-category": return { slug: required(input.slug, "SLUG"), name: required(input.name, "NAME") };
  }
}

export async function saveCmsContent(input: CmsContentFormData, actorId?: string) {
  const record = toRecord(input);
  const before = input.id ? await getCmsContent(input.entityType, input.id) : null;
  const previousMediaId = before && typeof before === "object" ? input.entityType === "gallery-item" || input.entityType === "testimonial" ? String((before as Record<string, unknown>).mediaId ?? "") : input.entityType === "post" ? String((before as Record<string, unknown>).coverMediaId ?? "") : ["activity", "experience"].includes(input.entityType) ? String((before as Record<string, unknown>).heroMediaId ?? "") : "" : "";
  const saved = await db.$transaction(async (tx) => {
    if (input.entityType === "gallery-item") {
      const media = await tx.media.findFirst({ where: { id: input.mediaId, origin: "ADMIN", deletedAt: null }, select: { id: true, isPublic: true, meta: true } });
      const meta = media?.meta && typeof media.meta === "object" && !Array.isArray(media.meta) ? media.meta as Record<string, unknown> : {};
      const pendingOwned = meta.pending === true && meta.pendingById === actorId && typeof meta.pendingUntil === "string" && new Date(meta.pendingUntil) > new Date();
      if (!media || (!media.isPublic && !pendingOwned)) throw new Error("CMS_MEDIA_UNAVAILABLE");
      if (pendingOwned) await tx.media.update({ where: { id: media.id }, data: { isPublic: true, meta: Prisma.DbNull } });
    }
    if (["activity", "experience"].includes(input.entityType) && input.heroMediaId) {
      const media = await tx.media.findFirst({ where: { id: input.heroMediaId, origin: "ADMIN", deletedAt: null }, select: { id: true, isPublic: true, meta: true } });
      const meta = media?.meta && typeof media.meta === "object" && !Array.isArray(media.meta) ? media.meta as Record<string, unknown> : {};
      const pendingOwned = meta.pending === true && meta.pendingById === actorId && typeof meta.pendingUntil === "string" && new Date(meta.pendingUntil) > new Date();
      if (!media || (!media.isPublic && !pendingOwned)) throw new Error("CMS_MEDIA_UNAVAILABLE");
      if (pendingOwned) await tx.media.update({ where: { id: media.id }, data: { isPublic: true, meta: Prisma.DbNull } });
    }
    if (input.entityType === "testimonial" && input.mediaId) {
      const media = await tx.media.findFirst({ where: { id: input.mediaId, origin: "ADMIN", isPublic: true, deletedAt: null }, select: { id: true } });
      if (!media) throw new Error("CMS_MEDIA_UNAVAILABLE");
    }
    if (input.entityType === "post" && input.coverMediaId) {
      const media = await tx.media.findFirst({ where: { id: input.coverMediaId, origin: "ADMIN", isPublic: true, deletedAt: null }, select: { id: true } });
      if (!media) throw new Error("CMS_MEDIA_UNAVAILABLE");
    }
    if (input.entityType === "offer" && (input.packageIds?.length ?? 0) > 0) {
      const packageCount = await tx.package.count({ where: { id: { in: input.packageIds }, deletedAt: null } });
      if (packageCount !== input.packageIds?.length) throw new Error("CMS_PACKAGE_UNAVAILABLE");
    }
    const delegate = {
      activity: tx.activity, experience: tx.experience, "menu-category": tx.menuCategory,
      "menu-item": tx.menuItem, faq: tx.faq, offer: tx.offer, testimonial: tx.testimonial,
      "gallery-item": tx.galleryItem, post: tx.post, "post-category": tx.postCategory,
    }[input.entityType] as unknown as {
      update(args: { where: { id: string }; data: never }): Promise<{ id: string }>;
      create(args: { data: never }): Promise<{ id: string }>;
    };
    const saved = input.id
      ? await delegate.update({ where: { id: input.id }, data: record as never })
      : await delegate.create({ data: record as never });
    if (["gallery-item", "testimonial", "post", "activity", "experience"].includes(input.entityType)) {
      const mediaId = input.entityType === "gallery-item" || input.entityType === "testimonial" ? input.mediaId : input.entityType === "post" ? input.coverMediaId : input.heroMediaId;
      const entityType = input.entityType === "gallery-item" ? "GalleryItem" : input.entityType === "testimonial" ? "Testimonial" : input.entityType === "post" ? "Post" : input.entityType === "activity" ? "Activity" : "Experience";
      const field = input.entityType === "post" ? "cover" : input.entityType === "testimonial" ? "testimonial" : input.entityType === "gallery-item" ? "gallery" : "hero";
      await tx.mediaUsage.deleteMany({ where: { entityType, entityId: saved.id } });
      if (mediaId) await tx.mediaUsage.create({ data: { mediaId, entityType, entityId: saved.id, field } });
    }
    return saved;
  }, { isolationLevel: "Serializable" });
  const nextMediaId = input.entityType === "gallery-item" || input.entityType === "testimonial" ? input.mediaId : input.entityType === "post" ? input.coverMediaId : input.heroMediaId;
  if (previousMediaId && previousMediaId !== nextMediaId) await cleanupUnusedAdminMedia(previousMediaId);
  return saved;
}

const modelByType = {
  activity: "activity", experience: "experience", "menu-category": "menuCategory", "menu-item": "menuItem", faq: "faq", offer: "offer", testimonial: "testimonial", "gallery-item": "galleryItem", post: "post", "post-category": "postCategory",
} as const;

export async function getCmsContent(type: CmsContentType, id: string) {
  switch (type) {
    case "activity": return db.activity.findUnique({ where: { id } });
    case "experience": return db.experience.findUnique({ where: { id } });
    case "menu-category": return db.menuCategory.findUnique({ where: { id } });
    case "menu-item": return db.menuItem.findUnique({ where: { id } });
    case "faq": return db.faq.findUnique({ where: { id } });
    case "offer": return db.offer.findUnique({ where: { id } });
    case "testimonial": return db.testimonial.findUnique({ where: { id } });
    case "gallery-item": return db.galleryItem.findUnique({ where: { id } });
    case "post": return db.post.findUnique({ where: { id } });
    case "post-category": return db.postCategory.findUnique({ where: { id } });
  }
}

export async function listCmsContent(input: { entityType: CmsContentType; page: number; q: string; status?: PublishStatus; trash: boolean }) {
  const delegate = db[modelByType[input.entityType]] as unknown as { findMany(args: object): Promise<Array<Record<string, unknown>>>; count(args: object): Promise<number> };
  const searchableFields: Partial<Record<CmsContentType, { text: string[]; json: string[] }>> = {
    activity: { text: ["slug"], json: ["name", "summary", "description"] }, experience: { text: ["slug"], json: ["title", "summary", "body"] },
    "menu-category": { text: ["slug"], json: ["name"] }, "menu-item": { text: [], json: ["name", "description"] }, faq: { text: ["groupKey"], json: ["question", "answer"] },
    offer: { text: ["slug"], json: ["title", "description"] }, testimonial: { text: ["authorName"], json: ["quote"] }, "gallery-item": { text: ["category"], json: ["caption"] },
    post: { text: ["slug", "authorName"], json: ["title", "excerpt", "body"] }, "post-category": { text: ["slug"], json: ["name"] },
  };
  const fields = searchableFields[input.entityType] ?? { text: [], json: [] };
  const searchOr = [
    ...fields.text.map((field) => ({ [field]: { contains: input.q, mode: "insensitive" } })),
    ...fields.json.map((field) => ({ [field]: { path: ["en"], string_contains: input.q, mode: "insensitive" } })),
  ];
  const where = {
    deletedAt: input.trash ? { not: null } : null,
    ...(input.entityType !== "post-category" ? statusWhere(input.status) : {}),
    ...(input.q ? { OR: searchOr } : {}),
  };
  const [rows, total] = await Promise.all([delegate.findMany({ where, skip: (input.page - 1) * CMS_CONTENT_PAGE_SIZE, take: CMS_CONTENT_PAGE_SIZE, orderBy: { id: "asc" } }), delegate.count({ where })]);
  return { rows, total, page: input.page, pageSize: CMS_CONTENT_PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / CMS_CONTENT_PAGE_SIZE)) };
}

export async function getCmsEditorOptions(type: CmsContentType) {
  const { getGalleryCategories } = await import("./gallery-categories");
  const [menuCategories, postCategories, packages, media, galleryCategories] = await Promise.all([
    type === "menu-item" ? db.menuCategory.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }) : [],
    type === "post" ? db.postCategory.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" }, select: { id: true, name: true } }) : [],
    type === "offer" ? db.package.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, code: true } }) : [],
    ["gallery-item", "activity", "experience", "post", "testimonial"].includes(type)
      ? db.media.findMany({ where: { origin: "ADMIN", isPublic: true, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, publicId: true, kind: true, altText: true, format: true } })
      : [],
    type === "gallery-item" ? getGalleryCategories() : Promise.resolve([]),
  ]);
  const label = (value: unknown, fallback: string) => value && typeof value === "object" && "en" in value ? String(value.en ?? fallback) : fallback;
  return {
    options: [...menuCategories, ...postCategories].map((row) => ({ id: row.id, label: label(row.name, row.id) })),
    packageOptions: packages.map((row) => ({ id: row.id, label: `${row.code ?? ""} — ${row.slug}` })),
    media,
    galleryCategories,
  };
}

export async function setCmsContentStatus(type: CmsContentType, id: string, status: PublishStatus, publishAt: Date | null) {
  if (type === "offer") return db.offer.update({ where: { id }, data: { status } });
  if (type === "testimonial") {
    const result = await db.testimonial.updateMany({
      where: { id, deletedAt: null, ...(status === "PUBLISHED" || status === "SCHEDULED" ? { consentConfirmed: true } : {}) },
      data: { status, publishAt: status === "SCHEDULED" ? publishAt : null },
    });
    if (!result.count) throw new Error("CMS_TESTIMONIAL_CONSENT_REQUIRED");
    return db.testimonial.findUniqueOrThrow({ where: { id } });
  }
  if (type === "gallery-item" && status === "PUBLISHED") {
    const item = await db.galleryItem.findFirst({ where: { id, deletedAt: null }, include: { media: { select: { origin: true, isPublic: true, deletedAt: true } } } });
    if (!item || item.media.origin !== "ADMIN" || !item.media.isPublic || item.media.deletedAt) throw new Error("CMS_GALLERY_MEDIA_NOT_PUBLIC");
  }
  const data = { status, publishAt: status === "SCHEDULED" ? publishAt : null, ...(type === "menu-item" || type === "faq" ? { isPublished: status === "PUBLISHED" } : {}) };
  switch (type) {
    case "activity": return db.activity.update({ where: { id }, data }); case "experience": return db.experience.update({ where: { id }, data });
    case "menu-category": return db.menuCategory.update({ where: { id }, data }); case "menu-item": return db.menuItem.update({ where: { id }, data });
    case "faq": return db.faq.update({ where: { id }, data });
    case "gallery-item": return db.galleryItem.update({ where: { id }, data });
    case "post": return db.post.update({ where: { id }, data }); case "post-category": throw new Error("POST_CATEGORY_CANNOT_PUBLISH");
  }
}

export async function reorderGalleryItems(id: string, direction: "up" | "down") {
  return db.$transaction(async (tx) => {
    const current = await tx.galleryItem.findFirst({ where: { id, deletedAt: null }, select: { id: true, category: true } });
    if (!current) return { moved: false, current: undefined };
    const rows = await tx.galleryItem.findMany({ where: { category: current.category, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, sortOrder: true } });
    const currentIndex = rows.findIndex((row) => row.id === id);
    const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rows.length) return { moved: false, current };
    const reordered = [...rows];
    const [moving] = reordered.splice(currentIndex, 1);
    if (!moving) return { moved: false, current };
    reordered.splice(targetIndex, 0, moving);
    await Promise.all(reordered.map((row, sortOrder) => tx.galleryItem.update({ where: { id: row.id }, data: { sortOrder } })));
    return { moved: true, current, from: currentIndex, to: targetIndex };
  }, { isolationLevel: "Serializable" });
}

export async function reorderActivity(id: string, direction: "up" | "down") {
  return db.$transaction(async (tx) => {
    const rows = await tx.activity.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, sortOrder: true } });
    const currentIndex = rows.findIndex((row) => row.id === id); const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rows.length) return { moved: false };
    const reordered = [...rows]; const moving = reordered.splice(currentIndex, 1)[0]; if (!moving) return { moved: false };
    reordered.splice(targetIndex, 0, moving); await Promise.all(reordered.map((row, sortOrder) => tx.activity.update({ where: { id: row.id }, data: { sortOrder } })));
    return { moved: true };
  }, { isolationLevel: "Serializable" });
}

export async function listGalleryAdmin(input: { q: string; status?: PublishStatus; category?: string; duplicatesOnly: boolean }) {
  const allMedia = await db.media.findMany({ where: { contentHash: { not: null }, deletedAt: null }, select: { contentHash: true } });
  const counts = new Map<string, number>(); for (const media of allMedia) if (media.contentHash) counts.set(media.contentHash, (counts.get(media.contentHash) ?? 0) + 1);
  const duplicateHashes = [...counts.entries()].filter(([, count]) => count > 1).map(([hash]) => hash);
  const rows = await db.galleryItem.findMany({ where: { deletedAt: null, ...(input.status ? { status: input.status } : {}), ...(input.category ? { category: input.category } : {}), ...(input.q ? { OR: [{ category: { contains: input.q, mode: "insensitive" } }, { media: { publicId: { contains: input.q, mode: "insensitive" } } }, { caption: { path: ["en"], string_contains: input.q, mode: "insensitive" } }] } : {}), ...(input.duplicatesOnly ? { media: { contentHash: { in: duplicateHashes } } } : {}) }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }], include: { media: { select: { id: true, publicId: true, format: true, bytes: true, width: true, height: true, contentHash: true, altText: true, tags: true, isPublic: true } } }, take: 500 });
  const categoryCounts = await db.galleryItem.groupBy({ by: ["category"], where: { deletedAt: null }, _count: { _all: true } });
  return { rows, duplicateHashes, categoryCounts: categoryCounts.map((item) => ({ category: item.category, count: item._count._all })) };
}

export async function updateGalleryFlags(id: string, changes: { isFeatured?: boolean; status?: PublishStatus }) {
  return db.galleryItem.update({ where: { id }, data: { ...(changes.isFeatured === undefined ? {} : { isFeatured: changes.isFeatured }), ...(changes.status ? { status: changes.status, publishAt: null } : {}) } });
}

export async function bulkUpdateGallery(input: { ids: string[]; action: "publish" | "unpublish" | "delete" | "category"; category?: string }) {
  const items = await db.$transaction(async (tx) => {
    const items = await tx.galleryItem.findMany({ where: { id: { in: input.ids }, deletedAt: null }, select: { id: true, mediaId: true } });
    if (input.action === "delete") {
      await tx.galleryItem.updateMany({ where: { id: { in: items.map((item) => item.id) } }, data: { deletedAt: new Date(), status: "ARCHIVED", isFeatured: false } });
      await tx.mediaUsage.deleteMany({ where: { entityType: "GalleryItem", entityId: { in: items.map((item) => item.id) } } });
    } else if (input.action === "category" && input.category) await tx.galleryItem.updateMany({ where: { id: { in: items.map((item) => item.id) } }, data: { category: input.category } });
    else await tx.galleryItem.updateMany({ where: { id: { in: items.map((item) => item.id) } }, data: { status: input.action === "publish" ? "PUBLISHED" : "DRAFT", publishAt: null } });
    return items;
  }, { isolationLevel: "Serializable" });
  if (input.action === "delete") for (const item of items) await cleanupUnusedAdminMedia(item.mediaId);
  return items;
}

export async function softDeleteCmsContent(type: CmsContentType, id: string) {
  const before = await getCmsContent(type, id);
  if (!before) return null;
  if (["menu-category", "post-category"].includes(type)) {
    const linkedChildren = type === "menu-category" ? await db.menuItem.count({ where: { categoryId: id, deletedAt: null } }) : await db.post.count({ where: { categoryId: id, deletedAt: null } });
    if (hasCmsReferences(type, { linkedChildren })) throw new Error("CMS_REFERENCED");
  }
  if (type === "activity") {
    const [packageActivities, favourites] = await Promise.all([db.packageActivity.count({ where: { activityId: id } }), db.favourite.count({ where: { entityType: type, entityId: id } })]);
    if (hasCmsReferences(type, { packageActivities, favourites })) throw new Error("CMS_REFERENCED");
  }
  if (type === "experience" && hasCmsReferences(type, { favourites: await db.favourite.count({ where: { entityType: type, entityId: id } }) })) throw new Error("CMS_REFERENCED");
  if (type === "offer" && hasCmsReferences(type, { bookings: await db.booking.count({ where: { offerId: id } }) })) throw new Error("CMS_REFERENCED");
  if (type === "gallery-item") {
    const item = await db.$transaction(async (tx) => {
      const current = await tx.galleryItem.findUnique({ where: { id }, select: { id: true, mediaId: true, deletedAt: true } });
      if (!current || current.deletedAt) return null;
      const saved = await tx.galleryItem.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED", isFeatured: false } });
      await tx.mediaUsage.deleteMany({ where: { entityType: "GalleryItem", entityId: id } });
      return { saved, mediaId: current.mediaId };
    });
    if (item) await cleanupUnusedAdminMedia(item.mediaId);
    return item?.saved ?? null;
  }
  const data = { deletedAt: new Date() };
  switch (type) {
    case "activity": return db.activity.update({ where: { id }, data }); case "experience": return db.experience.update({ where: { id }, data });
    case "menu-category": return db.menuCategory.update({ where: { id }, data }); case "menu-item": return db.menuItem.update({ where: { id }, data });
    case "faq": return db.faq.update({ where: { id }, data }); case "offer": return db.offer.update({ where: { id }, data });
    case "testimonial": return db.testimonial.update({ where: { id }, data });
    case "post": return db.post.update({ where: { id }, data }); case "post-category": return db.postCategory.update({ where: { id }, data });
  }
}

export async function restoreCmsContent(type: CmsContentType, id: string) {
  const data = { deletedAt: null };
  switch (type) {
    case "activity": return db.activity.update({ where: { id }, data }); case "experience": return db.experience.update({ where: { id }, data });
    case "menu-category": return db.menuCategory.update({ where: { id }, data }); case "menu-item": return db.menuItem.update({ where: { id }, data });
    case "faq": return db.faq.update({ where: { id }, data }); case "offer": return db.offer.update({ where: { id }, data });
    case "testimonial": return db.testimonial.update({ where: { id }, data }); case "gallery-item": return db.galleryItem.update({ where: { id }, data });
    case "post": return db.post.update({ where: { id }, data }); case "post-category": return db.postCategory.update({ where: { id }, data });
  }
}

export async function getCmsContentForPreview(type: CmsContentType, id: string) {
  switch (type) {
    case "activity": return db.activity.findFirst({ where: { id, deletedAt: null } }); case "experience": return db.experience.findFirst({ where: { id, deletedAt: null } });
    case "menu-category": return db.menuCategory.findFirst({ where: { id, deletedAt: null } }); case "menu-item": return db.menuItem.findFirst({ where: { id, deletedAt: null } });
    case "faq": return db.faq.findFirst({ where: { id, deletedAt: null } }); case "offer": return db.offer.findFirst({ where: { id, deletedAt: null } });
    case "testimonial": return db.testimonial.findFirst({ where: { id, deletedAt: null } }); case "gallery-item": return db.galleryItem.findFirst({ where: { id, deletedAt: null }, include: { media: true } });
    case "post": return db.post.findFirst({ where: { id, deletedAt: null } }); case "post-category": return null;
  }
}

export async function getPublicCmsContent(type: CmsContentType) {
  const now = new Date();
  const query = async () => {
    switch (type) {
      case "activity": return db.activity.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
      case "experience": return db.experience.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
      case "menu-category": return db.menuCategory.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], include: { items: { where: publicCmsWhere("menu-item", now) as never, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
      case "menu-item": return db.menuItem.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
      case "faq": return db.faq.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }] });
      case "offer": return db.offer.findMany({ where: publicCmsWhere(type, now) as never });
      case "testimonial": return db.testimonial.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
      case "gallery-item": return db.galleryItem.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ category: "asc" }, { sortOrder: "asc" }], include: { media: true } });
      case "post": return db.post.findMany({ where: publicCmsWhere(type, now) as never, orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }] });
      case "post-category": return db.postCategory.findMany({ where: { deletedAt: null }, orderBy: [{ name: "asc" }] });
    }
  };
  return unstable_cache(query, [`cms:public:${type}`, String(Math.floor(now.getTime() / 60_000))], { tags: [`cms:${type}`, "cms:all"], revalidate: 60 })();
}

export async function publishScheduledCms(now = new Date(), take = 100) {
  return db.$transaction(async (tx) => {
    const activityIds = (await tx.activity.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, deletedAt: null }, take, select: { id: true } })).map((row) => row.id);
    const experienceIds = (await tx.experience.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, deletedAt: null }, take, select: { id: true } })).map((row) => row.id);
    const menuCategoryIds = (await tx.menuCategory.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, deletedAt: null }, take, select: { id: true } })).map((row) => row.id);
    const menuItemIds = (await tx.menuItem.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, deletedAt: null }, take, select: { id: true } })).map((row) => row.id);
    const faqIds = (await tx.faq.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, deletedAt: null }, take, select: { id: true } })).map((row) => row.id);
    const postIds = (await tx.post.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, deletedAt: null, AND: [{ OR: [{ sourceSubmissionId: null }, { sourceSubmission: { status: "APPROVED", consentPublish: true } }] }] }, take, select: { id: true } })).map((row) => row.id);
    const testimonialIds = (await tx.testimonial.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, consentConfirmed: true, deletedAt: null }, take, select: { id: true } })).map((row) => row.id);
    const galleryIds = (await tx.galleryItem.findMany({ where: { status: "SCHEDULED", publishAt: { lte: now }, deletedAt: null, media: { origin: "ADMIN", isPublic: true, deletedAt: null } }, take, select: { id: true } })).map((row) => row.id);
    const results = await Promise.all([
      tx.activity.updateMany({ where: { id: { in: activityIds }, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishAt: null } }),
      tx.experience.updateMany({ where: { id: { in: experienceIds }, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishAt: null } }),
      tx.menuCategory.updateMany({ where: { id: { in: menuCategoryIds }, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishAt: null } }),
      tx.menuItem.updateMany({ where: { id: { in: menuItemIds }, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishAt: null, isPublished: true } }),
      tx.faq.updateMany({ where: { id: { in: faqIds }, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishAt: null, isPublished: true } }),
      tx.post.updateMany({ where: { id: { in: postIds }, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishAt: null } }),
      tx.testimonial.updateMany({ where: { id: { in: testimonialIds }, status: "SCHEDULED", consentConfirmed: true }, data: { status: "PUBLISHED", publishAt: null } }),
      tx.galleryItem.updateMany({ where: { id: { in: galleryIds }, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishAt: null } }),
    ]);
    return results.reduce((total: number, row) => total + row.count, 0);
  }, { isolationLevel: "Serializable" });
}
