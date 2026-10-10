import "server-only";

import { unstable_cache } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { pageCacheTag } from "@/lib/cms-page-policy";
import { pageBuilderSchema, type PageBuilderData } from "@/lib/schemas/cms/pages";
import { sanitizeLocalizedHtml } from "@/server/cms/html";
import { db } from "@/server/db";

function sectionContent(section: PageBuilderData["sections"][number]): Prisma.InputJsonValue {
  const content = section.type === "rich-text" || section.type === "image-text"
    ? { ...section.content, body: sanitizeLocalizedHtml(section.content.body) }
    : section.content;
  return content as Prisma.InputJsonValue;
}

function referencedMediaIds(input: PageBuilderData): string[] {
  return [...new Set(input.sections.flatMap((section) => {
    const id = "imageMediaId" in section.content ? section.content.imageMediaId : null;
    return typeof id === "string" && id ? [id] : [];
  }))];
}

export async function listPagesForBuilder() {
  return db.page.findMany({ where: { deletedAt: null }, orderBy: { slug: "asc" }, select: { id: true, slug: true, title: true, status: true, updatedAt: true } });
}

export async function getPageForBuilder(id: string) {
  return db.page.findFirst({ where: { id, deletedAt: null }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
}

export async function savePageBuilder(raw: PageBuilderData) {
  const parsed = pageBuilderSchema.parse(raw);
  const mediaIds = referencedMediaIds(parsed);
  return db.$transaction(async (tx) => {
    if (mediaIds.length) {
      const eligible = await tx.media.count({ where: { id: { in: mediaIds }, origin: "ADMIN", isPublic: true, deletedAt: null } });
      if (eligible !== mediaIds.length) throw new Error("PAGE_MEDIA_UNAVAILABLE");
    }
    const before = await tx.page.findFirst({ where: { id: parsed.id, deletedAt: null }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
    if (!before) throw new Error("PAGE_NOT_FOUND");
    await tx.mediaUsage.deleteMany({ where: { entityType: "PageSection", entityId: { in: before.sections.map((section) => section.id) } } });
    await tx.page.update({ where: { id: parsed.id }, data: { title: parsed.title as Prisma.InputJsonValue } });
    await tx.pageSection.deleteMany({ where: { pageId: parsed.id } });
    await Promise.all(parsed.sections.map(async (source, sortOrder) => {
      const section = await tx.pageSection.create({
        data: { pageId: parsed.id, type: source.type, content: sectionContent(source), sortOrder, isVisible: source.isVisible },
      });
      const mediaId = "imageMediaId" in source.content ? source.content.imageMediaId : null;
      if (typeof mediaId === "string" && mediaId) {
        await tx.mediaUsage.create({ data: { mediaId, entityType: "PageSection", entityId: section.id, field: "image" } });
      }
      return section;
    }));
    return { before, after: await tx.page.findUniqueOrThrow({ where: { id: parsed.id }, include: { sections: { orderBy: { sortOrder: "asc" } } } }) };
  }, { isolationLevel: "Serializable" });
}

export async function setPageStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  const page = await getPageForBuilder(id);
  if (!page) throw new Error("PAGE_NOT_FOUND");
  if (status === "PUBLISHED") {
    if (!page.sections.some((section) => section.isVisible)) throw new Error("PAGE_NEEDS_VISIBLE_SECTION");
    const input = pageBuilderSchema.safeParse({ id: page.id, title: page.title, sections: page.sections.map(({ type, content, isVisible }) => ({ type, content, isVisible })) });
    if (!input.success) throw new Error("PAGE_INVALID_SECTIONS");
    const mediaIds = referencedMediaIds(input.data);
    if (mediaIds.length) {
      const mediaCount = await db.media.count({ where: { id: { in: mediaIds }, origin: "ADMIN", isPublic: true, deletedAt: null } });
      if (mediaCount !== mediaIds.length) throw new Error("PAGE_MEDIA_UNAVAILABLE");
    }
  }
  const saved = await db.page.update({ where: { id }, data: { status } });
  return { before: page, after: saved };
}

export async function getPageForPreview(id: string) {
  const page = await db.page.findFirst({ where: { id, deletedAt: null }, include: { sections: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } } } });
  return page ? { ...page, images: await pageImages(page.sections) } : null;
}

export async function getPublishedPage(slug: string) {
  const page = await unstable_cache(async () => db.page.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: { sections: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } } },
  }), ["cms-published-page", slug], { tags: [pageCacheTag(slug)] })();
  return page ? { ...page, images: await pageImages(page.sections) } : null;
}

async function pageImages(sections: Array<{ content: Prisma.JsonValue }>) {
  const ids = [...new Set(sections.flatMap(({ content }) => {
    if (!content || typeof content !== "object" || Array.isArray(content)) return [];
    const id = content.imageMediaId;
    return typeof id === "string" && id ? [id] : [];
  }))];
  if (!ids.length) return [];
  return db.media.findMany({ where: { id: { in: ids }, origin: "ADMIN", isPublic: true, deletedAt: null }, select: { id: true, publicId: true, altText: true, format: true } });
}
