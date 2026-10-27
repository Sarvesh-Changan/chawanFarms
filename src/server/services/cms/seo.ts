import "server-only";

import { v2 as cloudinary } from "cloudinary";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import type { z } from "zod";

import { env } from "@/config/env";
import { SEO_CACHE_TAG } from "@/config/page-builder";
import { Prisma } from "@/generated/prisma/client";
import { seoMetadataSchema, type SeoEntityType } from "@/lib/schemas/cms/seo";
import { db } from "@/server/db";
import { cleanupUnusedAdminMedia } from "@/server/services/media";

type SeoMetadataData = z.output<typeof seoMetadataSchema>;

async function entityExists(type: SeoEntityType, id: string): Promise<boolean> {
  switch (type) {
    case "page": return Boolean(await db.page.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
    case "package": return Boolean(await db.package.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
    case "accommodation": return Boolean(await db.accommodation.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
    case "activity": return Boolean(await db.activity.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
    case "experience": return Boolean(await db.experience.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
    case "post": return Boolean(await db.post.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
  }
}

export async function getSeoMetadata(entityType: SeoEntityType, entityId: string, locale = "en") {
  return db.seoMetadata.findUnique({ where: { entityType_entityId_locale: { entityType, entityId, locale } } });
}

export async function getPublicSeoMetadata(entityType: SeoEntityType, entityId: string, locale = "en") {
  return unstable_cache(async () => db.seoMetadata.findUnique({ where: { entityType_entityId_locale: { entityType, entityId, locale } } }), ["cms-seo-public", entityType, entityId, locale], { tags: [SEO_CACHE_TAG, `cms:seo:${entityType}:${entityId}`] })();
}

export async function getPublishedEntityForSeo(entityType: Exclude<SeoEntityType, "page">, slug: string) {
  switch (entityType) {
    case "package": return db.package.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, select: { id: true } });
    case "accommodation": return db.accommodation.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true } });
    case "activity": return db.activity.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true } });
    case "experience": return db.experience.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true } });
    case "post": return db.post.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, select: { id: true } });
  }
}

export async function getPublicSeoWithImage(entityType: SeoEntityType, entityId: string, locale = "en") {
  const metadata = await getPublicSeoMetadata(entityType, entityId, locale);
  if (!metadata?.ogMediaId) return metadata ? { ...metadata, ogImagePublicId: null } : null;
  const media = await db.media.findFirst({ where: { id: metadata.ogMediaId, kind: "IMAGE", isPublic: true, deletedAt: null }, select: { publicId: true } });
  return { ...metadata, ogImagePublicId: media?.publicId ?? null };
}

export async function getPublicSeoForSlug(entityType: Exclude<SeoEntityType, "page">, slug: string) {
  const entity = await getPublishedEntityForSeo(entityType, slug);
  return entity ? getPublicSeoWithImage(entityType, entity.id) : null;
}

export function metadataFromSeo(seo: Awaited<ReturnType<typeof getPublicSeoWithImage>>, fallback: Metadata): Metadata {
  if (!seo) return fallback;
  const cloudName = env.CLOUDINARY_CLOUD_NAME ?? env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const image = seo.ogImagePublicId && cloudName ? cloudinary.url(seo.ogImagePublicId, { cloud_name: cloudName, secure: true, fetch_format: "auto", quality: "auto" }) : null;
  const directives = seo.robots?.split(",").map((directive) => directive.trim());
  return {
    ...fallback,
    ...(seo.title ? { title: seo.title } : {}),
    ...(seo.description ? { description: seo.description } : {}),
    ...(seo.keywords ? { keywords: seo.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean) } : {}),
    ...(seo.canonicalUrl ? { alternates: { canonical: seo.canonicalUrl } } : {}),
    ...(directives ? { robots: { index: directives.includes("index"), follow: directives.includes("follow") } } : {}),
    ...(image ? { openGraph: { ...(fallback.openGraph && typeof fallback.openGraph === "object" ? fallback.openGraph : {}), images: [image] } } : {}),
  };
}

export async function saveSeoMetadata(input: SeoMetadataData, actorId?: string) {
  if (!(await entityExists(input.entityType, input.entityId))) throw new Error("SEO_ENTITY_NOT_FOUND");
  const previous = await db.seoMetadata.findUnique({ where: { entityType_entityId_locale: { entityType: input.entityType, entityId: input.entityId, locale: input.locale } }, select: { ogMediaId: true } });
  const saved = await db.$transaction(async (tx) => {
    if (input.ogMediaId) {
      const media = await tx.media.findFirst({ where: { id: input.ogMediaId, kind: "IMAGE", origin: "ADMIN", deletedAt: null }, select: { id: true, isPublic: true, meta: true } });
      const meta = media?.meta && typeof media.meta === "object" && !Array.isArray(media.meta) ? media.meta as Record<string, unknown> : {};
      const pendingOwned = meta.pending === true && meta.pendingById === actorId && typeof meta.pendingUntil === "string" && new Date(meta.pendingUntil) > new Date();
      if (!media || (!media.isPublic && !pendingOwned)) throw new Error("SEO_MEDIA_UNAVAILABLE");
      if (pendingOwned) await tx.media.update({ where: { id: media.id }, data: { isPublic: true, meta: Prisma.DbNull } });
    }
    const saved = await tx.seoMetadata.upsert({
      where: { entityType_entityId_locale: { entityType: input.entityType, entityId: input.entityId, locale: input.locale } },
      create: { entityType: input.entityType, entityId: input.entityId, locale: input.locale, title: input.title || null, description: input.description || null, keywords: input.keywords || null, canonicalUrl: input.canonicalUrl || null, robots: input.robots || null, ogMediaId: input.ogMediaId || null, jsonLd: input.jsonLd ?? Prisma.DbNull },
      update: { title: input.title || null, description: input.description || null, keywords: input.keywords || null, canonicalUrl: input.canonicalUrl || null, robots: input.robots || null, ogMediaId: input.ogMediaId || null, jsonLd: input.jsonLd ?? Prisma.DbNull },
    });
    await tx.mediaUsage.deleteMany({ where: { entityType: "SeoMetadata", entityId: `${input.entityType}:${input.entityId}:${input.locale}`, field: "og" } });
    if (input.ogMediaId) await tx.mediaUsage.create({ data: { mediaId: input.ogMediaId, entityType: "SeoMetadata", entityId: `${input.entityType}:${input.entityId}:${input.locale}`, field: "og" } });
    return saved;
  }, { isolationLevel: "Serializable" });
  if (previous?.ogMediaId && previous.ogMediaId !== input.ogMediaId) await cleanupUnusedAdminMedia(previous.ogMediaId);
  return saved;
}

export async function getSeoImageOptions() {
  return db.media.findMany({ where: { kind: "IMAGE", origin: "ADMIN", isPublic: true, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, publicId: true, altText: true, format: true } });
}
