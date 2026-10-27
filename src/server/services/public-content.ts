import "server-only";

import { unstable_cache } from "next/cache";

import { siteContentDefaults } from "@/config/site-content";
import { Prisma } from "@/generated/prisma/client";
import { normalizeLeadPhone } from "@/lib/lead-phone";
import { db } from "@/server/db";

const cacheRevalidateSeconds = 300;
const published = { status: "PUBLISHED" as const, deletedAt: null };

const publicMediaSelect = {
  id: true,
  publicId: true,
  kind: true,
  resourceType: true,
  altText: true,
  caption: true,
  focalX: true,
  focalY: true,
  width: true,
  height: true,
  durationSec: true,
} as const;

export type PublicMedia = Prisma.MediaGetPayload<{ select: typeof publicMediaSelect }>;

function localizedString(value: Prisma.JsonValue | null | undefined): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function socialLinkValues(value: Prisma.JsonValue | null | undefined): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.label !== "string" || typeof record.url !== "string") return [];
    try {
      return new URL(record.url).protocol === "https:" ? [{ label: record.label, url: record.url }] : [];
    } catch {
      return [];
    }
  });
}

async function mediaMap(ids: Array<string | null | undefined>): Promise<Map<string, PublicMedia>> {
  const mediaIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!mediaIds.length) return new Map();
  const media = await db.media.findMany({
    where: { id: { in: mediaIds }, origin: "ADMIN", isPublic: true, deletedAt: null },
    select: publicMediaSelect,
  });
  return new Map(media.map((item) => [item.id, item]));
}

export type PublicSettings = {
  phones: string[];
  address: string;
  socialLinks?: Array<{ label: string; url: string }>;
  whatsappNumber: string;
  whatsappMessage: string;
  home: { hero: { headline: string; subhead: string; cta: string; secondaryCta?: string; media?: PublicMedia | null }; closing: { headline: string } };
  owner?: { display: boolean; name: string; caption: string; media: PublicMedia | null };
};

export async function getPublicSettings(): Promise<PublicSettings> {
  return unstable_cache(async () => {
    try {
      const rows = await db.setting.findMany({
        where: { key: { in: ["business.phones", "business.address", "business.socialLinks", "whatsapp.number", "whatsapp.defaultMessage", "home.hero.headline", "home.hero.subhead", "home.hero.cta", "home.hero.primaryCta", "home.hero.secondaryCta", "home.hero.mediaId", "home.closing.headline", "owner.display", "owner.mediaId", "owner.name", "owner.caption"] } },
        select: { key: true, value: true },
      });
      const values = new Map(rows.map((row) => [row.key, row.value]));
      const rawPhones = values.get("business.phones");
      const phones = (Array.isArray(rawPhones) ? rawPhones : typeof rawPhones === "string" ? rawPhones.split(/\r?\n/) : [])
        .flatMap((value) => typeof value === "string" ? [value] : value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).number === "string" ? [(value as Record<string, unknown>).number as string] : [])
        .flatMap((value) => {
          try {
            return [normalizeLeadPhone(value)];
          } catch {
            return [];
          }
        });
      const address = jsonRecord(values.get("business.address"));
      const socialLinks = socialLinkValues(values.get("business.socialLinks"));
      const rawWhatsapp = values.get("whatsapp.number");
      const whatsapp = typeof rawWhatsapp === "string" ? rawWhatsapp : "";
      const whatsappMessage = jsonRecord(values.get("whatsapp.defaultMessage"));
      let whatsappNumber = "";
      try {
        whatsappNumber = whatsapp ? normalizeLeadPhone(whatsapp) : "";
      } catch {
        whatsappNumber = "";
      }
      const stringSetting = (key: string, fallback: string) => {
        const value = values.get(key);
        const record = jsonRecord(value);
        return typeof record.en === "string" && record.en.trim() ? record.en : typeof value === "string" && value.trim() ? value : fallback;
      };
      const heroMediaId = typeof values.get("home.hero.mediaId") === "string" ? values.get("home.hero.mediaId") as string : null;
      const ownerMediaId = typeof values.get("owner.mediaId") === "string" ? values.get("owner.mediaId") as string : null;
      const media = await mediaMap([heroMediaId, ownerMediaId]);
      const ownerDisplay = values.get("owner.display") === true;
      return {
        phones: [...new Set(phones)],
        address: typeof address.en === "string" ? address.en : "",
        socialLinks,
        whatsappNumber,
        whatsappMessage: typeof whatsappMessage.en === "string" ? whatsappMessage.en : "",
        home: {
          hero: { headline: stringSetting("home.hero.headline", siteContentDefaults.home.hero.headline), subhead: stringSetting("home.hero.subhead", siteContentDefaults.home.hero.subhead), cta: stringSetting("home.hero.primaryCta", stringSetting("home.hero.cta", siteContentDefaults.home.hero.cta)), secondaryCta: stringSetting("home.hero.secondaryCta", "Explore experiences"), media: heroMediaId ? media.get(heroMediaId) ?? null : null },
          closing: { headline: stringSetting("home.closing.headline", siteContentDefaults.home.closing.headline) },
        },
        owner: { display: ownerDisplay && Boolean(ownerMediaId && media.get(ownerMediaId)), name: stringSetting("owner.name", ""), caption: stringSetting("owner.caption", ""), media: ownerDisplay && ownerMediaId ? media.get(ownerMediaId) ?? null : null },
      };
    } catch {
      return {
        phones: [],
        address: "",
        socialLinks: [],
        whatsappNumber: "",
        whatsappMessage: "",
        home: { hero: { ...siteContentDefaults.home.hero, secondaryCta: "Explore experiences", media: null }, closing: siteContentDefaults.home.closing },
        owner: { display: false, name: "", caption: "", media: null },
      };
    }
  }, ["public-content:settings"], { tags: ["cms:settings", "cms:all"], revalidate: cacheRevalidateSeconds })();
}


export async function getPublicExperiences() {
  return unstable_cache(async () => {
    const rows = await db.experience.findMany({ where: published, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
    const media = await mediaMap(rows.map((row) => row.heroMediaId));
    return rows.map((row) => ({ ...row, heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null }));
  }, ["public-content:experiences"], { tags: ["cms:experience", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicExperienceBySlug(slug: string) {
  return unstable_cache(async () => {
    const row = await db.experience.findFirst({ where: { slug, ...published } });
    if (!row) return null;
    const media = await mediaMap([row.heroMediaId]);
    return { ...row, heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null };
  }, ["public-content:experience", slug], { tags: ["cms:experience", `cms:experience:${slug}`, "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicAccommodations() {
  return unstable_cache(async () => {
    const rows = await db.accommodation.findMany({ where: published, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
    const media = await mediaMap(rows.flatMap((row) => [row.heroMediaId, ...row.imageMediaIds]));
    return rows.map((row) => ({
      ...row,
      heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null,
      gallery: row.imageMediaIds.map((id) => media.get(id)).filter((item): item is PublicMedia => Boolean(item)),
    }));
  }, ["public-content:accommodations"], { tags: ["cms:accommodations", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicAccommodationBySlug(slug: string) {
  return unstable_cache(async () => {
    const row = await db.accommodation.findFirst({ where: { slug, ...published } });
    if (!row) return null;
    const media = await mediaMap([row.heroMediaId, ...row.imageMediaIds]);
    return {
      ...row,
      heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null,
      gallery: row.imageMediaIds.map((id) => media.get(id)).filter((item): item is PublicMedia => Boolean(item)),
    };
  }, ["public-content:accommodation", slug], { tags: ["cms:accommodations", `cms:accommodation:${slug}`, "cms:all"], revalidate: cacheRevalidateSeconds })();
}

const validRateWhere = (now: Date) => ({
  isActive: true,
  AND: [
    { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
    { OR: [{ validTo: null }, { validTo: { gte: now } }] },
  ],
});

export async function getPublicPackages() {
  return unstable_cache(async () => {
    const rows = await db.package.findMany({
      where: published,
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      include: {
        rates: { where: validRateWhere(new Date()), orderBy: [{ amountPaise: "asc" }, { createdAt: "desc" }] },
        accommodations: { include: { accommodation: { select: { type: true, name: true } } } },
      },
    });
    const media = await mediaMap(rows.map((row) => row.heroMediaId));
    return rows.map((row) => ({ ...row, heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null }));
  }, ["public-content:packages"], { tags: ["cms:packages", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicPackageBySlug(slug: string) {
  return unstable_cache(async () => {
    const row = await db.package.findFirst({
      where: { slug, ...published },
      include: {
        rates: { where: validRateWhere(new Date()), orderBy: [{ amountPaise: "asc" }, { createdAt: "desc" }] },
        accommodations: { where: { accommodation: published }, include: { accommodation: true } },
        activities: { where: { activity: published }, include: { activity: true } },
      },
    });
    if (!row) return null;
    const media = await mediaMap([
      row.heroMediaId,
      ...row.accommodations.flatMap(({ accommodation }) => [accommodation.heroMediaId, ...accommodation.imageMediaIds]),
      ...row.activities.map(({ activity }) => activity.heroMediaId),
    ]);
    return {
      ...row,
      heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null,
      accommodations: row.accommodations.map((relation) => ({
        ...relation,
        accommodation: {
          ...relation.accommodation,
          heroMedia: relation.accommodation.heroMediaId ? media.get(relation.accommodation.heroMediaId) ?? null : null,
          gallery: relation.accommodation.imageMediaIds.map((id) => media.get(id)).filter((item): item is PublicMedia => Boolean(item)),
        },
      })),
      activities: row.activities.map((relation) => ({
        ...relation,
        activity: { ...relation.activity, heroMedia: relation.activity.heroMediaId ? media.get(relation.activity.heroMediaId) ?? null : null },
      })),
    };
  }, ["public-content:package", slug], { tags: ["cms:packages", `cms:package:${slug}`, "cms:accommodations", "cms:activity", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicActivities() {
  return unstable_cache(async () => {
    const rows = await db.activity.findMany({ where: published, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
    const media = await mediaMap(rows.map((row) => row.heroMediaId));
    return rows.map((row) => ({ ...row, heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null }));
  }, ["public-content:activities"], { tags: ["cms:activity", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicActivityBySlug(slug: string) {
  return unstable_cache(async () => {
    const row = await db.activity.findFirst({ where: { slug, ...published } });
    if (!row) return null;
    const media = await mediaMap([row.heroMediaId]);
    return { ...row, heroMedia: row.heroMediaId ? media.get(row.heroMediaId) ?? null : null };
  }, ["public-content:activity", slug], { tags: ["cms:activity", `cms:activity:${slug}`, "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicFood() {
  return unstable_cache(async () => db.menuCategory.findMany({
    where: published,
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    include: { items: { where: { ...published, isPublished: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  }), ["public-content:food"], { tags: ["cms:menu-category", "cms:menu-item", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicGallery() {
  return unstable_cache(async () => db.galleryItem.findMany({
    where: { ...published, media: { origin: "ADMIN", isPublic: true, deletedAt: null } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    include: { media: { select: publicMediaSelect } },
  }), ["public-content:gallery"], { tags: ["cms:gallery-item", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicStories() {
  return unstable_cache(async () => {
    const rows = await db.post.findMany({
      where: { ...published, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      include: { category: true },
      orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
    });
    const media = await mediaMap(rows.map((row) => row.coverMediaId));
    return rows.map((row) => ({ ...row, coverMedia: row.coverMediaId ? media.get(row.coverMediaId) ?? null : null }));
  }, ["public-content:stories"], { tags: ["cms:post", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicStoryBySlug(slug: string) {
  return unstable_cache(async () => {
    const row = await db.post.findFirst({
      where: { slug, ...published, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      include: { category: true },
    });
    if (!row) return null;
    const media = await mediaMap([row.coverMediaId]);
    return { ...row, coverMedia: row.coverMediaId ? media.get(row.coverMediaId) ?? null : null };
  }, ["public-content:story", slug], { tags: ["cms:post", `cms:post:${slug}`, "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicOffers() {
  return unstable_cache(async () => {
    const now = new Date();
    return db.offer.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: [{ endsAt: "asc" }, { startsAt: "asc" }],
    });
  }, ["public-content:offers"], { tags: ["cms:offer", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicFaqs() {
  return unstable_cache(async () => db.faq.findMany({
    where: { ...published, isPublished: true },
    orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  }), ["public-content:faqs"], { tags: ["cms:faq", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicActiveRewardRule() {
  return unstable_cache(async () => db.rewardRule.findFirst({
    where: { isActive: true },
    include: {
      tiers: {
        where: { isActive: true },
        orderBy: [{ pointsCost: "asc" }],
      },
    },
  }), ["public-content:active-reward-rule"], { tags: ["cms:reward-rule", "rewards:rule", "cms:all"], revalidate: cacheRevalidateSeconds })();
}

export async function getPublicHomeData() {
  const [settings, experiences, accommodations, packages, activities, food, gallery, stories, activeRewardRule] = await Promise.all([
    getPublicSettings(),
    getPublicExperiences(),
    getPublicAccommodations(),
    getPublicPackages(),
    getPublicActivities(),
    getPublicFood(),
    getPublicGallery(),
    getPublicStories(),
    getPublicActiveRewardRule(),
  ]);
  return { settings, experiences, accommodations, packages, activities, food, gallery, stories, activeRewardRule };
}

export type PublicHomeData = Awaited<ReturnType<typeof getPublicHomeData>>;
export type PublicPackage = Awaited<ReturnType<typeof getPublicPackages>>[number];
export type PublicAccommodation = Awaited<ReturnType<typeof getPublicAccommodations>>[number];
export type PublicExperience = Awaited<ReturnType<typeof getPublicExperiences>>[number];
export type PublicActivity = Awaited<ReturnType<typeof getPublicActivities>>[number];
export type PublicStory = Awaited<ReturnType<typeof getPublicStories>>[number];
export type PublicOffer = Awaited<ReturnType<typeof getPublicOffers>>[number];
export type PublicFaq = Awaited<ReturnType<typeof getPublicFaqs>>[number];
export type PublicRewardRule = Awaited<ReturnType<typeof getPublicActiveRewardRule>>;
export { localizedString };

