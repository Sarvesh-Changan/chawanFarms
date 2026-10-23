import "server-only";

import { bookingOwnership, enquiryOwnership } from "@/lib/account-ownership";
import { accountIdSchema } from "@/lib/schemas/account";
import { db } from "@/server/db";

type CustomerIdentity = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
  profile: {
    phone: string | null;
    city: string | null;
    marketingConsent: boolean;
    referralCode: string;
    pointsBalance: number;
  } | null;
};

type FeatureFlags = {
  coupons: boolean;
  referrals: boolean;
};

export type AccountOverview = {
  identity: CustomerIdentity;
  pointsBalance: number;
  activeCoupons: number;
  pendingVideos: number;
  nextStay: {
    id: string;
    checkIn: Date;
    checkOut: Date;
    reference: string;
    packageSlug: string | null;
  } | null;
  lastPackageSlug: string | null;
  features: FeatureFlags;
};

function isTrue(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.toLowerCase() === "true");
}

async function getFeatureFlags(): Promise<FeatureFlags> {
  const rows = await db.setting.findMany({
    where: { key: { in: ["feature.coupons", "feature.referrals"] } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    coupons: isTrue(values.get("feature.coupons")),
    referrals: isTrue(values.get("feature.referrals")),
  };
}

export async function getCustomerIdentity(userId: string): Promise<CustomerIdentity | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      status: true,
      profile: {
        select: {
          phone: true,
          city: true,
          marketingConsent: true,
          referralCode: true,
          pointsBalance: true,
        },
      },
    },
  });
}

function dateOnly(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function jsonLabel(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const candidates = [record.en, record.English, record.title, record.name];
  for (const candidate of candidates) if (typeof candidate === "string") return candidate;
  return null;
}

export async function getAccountOverview(userId: string): Promise<AccountOverview | null> {
  const [identity, features] = await Promise.all([getCustomerIdentity(userId), getFeatureFlags()]);
  if (!identity) return null;
  const today = dateOnly(new Date());
  const owner = bookingOwnership(identity);
  const [activeCoupons, pendingVideos, nextStay, lastBooking] = await Promise.all([
    features.coupons ? db.coupon.count({ where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } } }) : Promise.resolve(0),
    db.videoSubmission.count({ where: { userId, status: "PENDING" } }),
    db.booking.findFirst({
      where: { ...owner, deletedAt: null, status: "CONFIRMED", checkIn: { gte: new Date(`${today}T00:00:00.000Z`) } },
      orderBy: { checkIn: "asc" },
      select: { id: true, checkIn: true, checkOut: true, reference: true, package: { select: { slug: true } } },
    }),
    db.booking.findFirst({
      where: { ...owner, deletedAt: null, package: { isNot: null } },
      orderBy: { createdAt: "desc" },
      select: { package: { select: { slug: true } } },
    }),
  ]);
  return {
    identity,
    pointsBalance: identity.profile?.pointsBalance ?? 0,
    activeCoupons,
    pendingVideos,
    nextStay: nextStay ? { ...nextStay, packageSlug: nextStay.package?.slug ?? null } : null,
    lastPackageSlug: lastBooking?.package?.slug ?? null,
    features,
  };
}

export async function listCustomerBookings(userId: string) {
  const identity = await getCustomerIdentity(userId);
  if (!identity) return [];
  return db.booking.findMany({
    where: { ...bookingOwnership(identity), deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, reference: true, status: true, paymentStatus: true, checkIn: true, checkOut: true,
      adults: true, children4to10: true, infantsUnder4: true, totalPaise: true,
      package: { select: { slug: true, name: true } },
      accommodation: { select: { slug: true, name: true } },
    },
  });
}

export async function getCustomerBooking(userId: string, id: string) {
  if (!accountIdSchema.safeParse(id).success) return null;
  const identity = await getCustomerIdentity(userId);
  if (!identity) return null;
  return db.booking.findFirst({
    where: { id, ...bookingOwnership(identity), deletedAt: null },
    select: {
      id: true, reference: true, status: true, paymentStatus: true, checkIn: true, checkOut: true,
      nights: true, adults: true, children4to10: true, infantsUnder4: true, foodPreference: true,
      contactName: true, contactPhone: true, contactEmail: true, subtotalPaise: true, discountPaise: true,
      taxPaise: true, totalPaise: true, pricingSnapshot: true, createdAt: true,
      package: { select: { slug: true, name: true } },
      accommodation: { select: { slug: true, name: true } },
      lines: { select: { kind: true, label: true, quantity: true, unitPaise: true, totalPaise: true }, orderBy: { id: "asc" } },
    },
  });
}

export async function listCustomerEnquiries(userId: string) {
  const identity = await getCustomerIdentity(userId);
  if (!identity) return [];
  return db.enquiry.findMany({
    where: enquiryOwnership(identity),
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, reference: true, type: true, message: true, preferredStart: true, preferredEnd: true,
      adults: true, children: true, infants: true, groupSize: true, createdAt: true,
      lead: { select: { status: true } },
    },
  });
}

export async function getCustomerEnquiry(userId: string, id: string) {
  if (!accountIdSchema.safeParse(id).success) return null;
  const identity = await getCustomerIdentity(userId);
  if (!identity) return null;
  return db.enquiry.findFirst({
    where: { id, ...enquiryOwnership(identity) },
    select: {
      id: true, reference: true, type: true, message: true, preferredStart: true, preferredEnd: true,
      adults: true, children: true, infants: true, groupSize: true, consentToContact: true, createdAt: true,
      lead: { select: { status: true } },
    },
  });
}

export async function getRewardsPageData(userId: string) {
  const [identity, rule] = await Promise.all([
    getCustomerIdentity(userId),
    db.rewardRule.findFirst({ where: { isActive: true }, orderBy: { version: "desc" }, include: { tiers: { where: { isActive: true }, orderBy: { pointsCost: "asc" } } } }),
  ]);
  if (!identity) return null;
  const ledger = await db.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, type: true, points: true, balanceAfter: true, reason: true, createdAt: true } });
  return { pointsBalance: identity.profile?.pointsBalance ?? 0, emailVerified: identity.emailVerified, ledger, rule };
}

export async function getCouponsPageData(userId: string) {
  const [features, coupons] = await Promise.all([
    getFeatureFlags(),
    db.coupon.findMany({ where: { userId }, orderBy: { issuedAt: "desc" }, take: 100, select: { id: true, code: true, status: true, discountType: true, discountValue: true, maxDiscountPaise: true, minBookingPaise: true, pointsSpent: true, issuedAt: true, expiresAt: true, tier: { select: { name: true, allPackages: true, allAccommodation: true } } } }),
  ]);
  return { features, coupons };
}

export async function getVideosPageData(userId: string) {
  return db.videoSubmission.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, status: true, rejectionReason: true, visitDate: true, submittedAt: true, createdAt: true } });
}

export async function getFavouritesPageData(userId: string) {
  const rows = await db.favourite.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, select: { entityType: true, entityId: true, createdAt: true } });
  return Promise.all(rows.map(async (row) => {
    if (row.entityType === "package") {
      const item = await db.package.findFirst({ where: { id: row.entityId, status: "PUBLISHED", deletedAt: null }, select: { slug: true, name: true } });
      return { ...row, label: jsonLabel(item?.name) ?? "Package", slug: item?.slug ?? null };
    }
    if (row.entityType === "experience") {
      const item = await db.experience.findFirst({ where: { id: row.entityId, status: "PUBLISHED", deletedAt: null }, select: { slug: true, title: true } });
      return { ...row, label: jsonLabel(item?.title) ?? "Experience", slug: item?.slug ?? null };
    }
    const item = await db.activity.findFirst({ where: { id: row.entityId, status: "PUBLISHED", deletedAt: null }, select: { slug: true, name: true } });
    return { ...row, label: jsonLabel(item?.name) ?? "Activity", slug: item?.slug ?? null };
  }));
}

export async function getNotificationsPageData(userId: string) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true } });
}

export async function getProfilePageData(userId: string) {
  const [identity, consents, features, deletionRequest] = await Promise.all([
    getCustomerIdentity(userId),
    db.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, purpose: true, granted: true, policyVersion: true, createdAt: true } }),
    getFeatureFlags(),
    db.accountDeletionRequest.findFirst({ where: { userId, status: "PENDING" }, select: { id: true, status: true, reasonText: true, requestedAt: true } }),
  ]);
  if (!identity) return null;
  return { identity, consents, features, deletionRequest };
}

export async function getPrivacyExport(userId: string) {
  const identity = await getCustomerIdentity(userId);
  if (!identity) return null;
  const [features, bookings, enquiries, ledger, coupons, videos, consents, favourites, notifications] = await Promise.all([
    getFeatureFlags(),
    listCustomerBookings(userId), listCustomerEnquiries(userId),
    db.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { type: true, points: true, balanceAfter: true, reason: true, expiresAt: true, createdAt: true } }),
    db.coupon.findMany({ where: { userId }, orderBy: { issuedAt: "asc" }, select: { code: true, status: true, discountType: true, discountValue: true, maxDiscountPaise: true, minBookingPaise: true, pointsSpent: true, issuedAt: true, expiresAt: true } }),
    db.videoSubmission.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { status: true, title: true, visitDate: true, submittedAt: true, createdAt: true, rejectionReason: true } }),
    db.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { purpose: true, granted: true, policyVersion: true, createdAt: true } }),
    db.favourite.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { entityType: true, entityId: true, createdAt: true } }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { type: true, title: true, body: true, link: true, readAt: true, createdAt: true } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: { name: identity.name, email: identity.email, emailVerified: identity.emailVerified, phone: identity.profile?.phone ?? null, city: identity.profile?.city ?? null, marketingConsent: identity.profile?.marketingConsent ?? false, referralCode: features.referrals ? identity.profile?.referralCode ?? null : null },
    bookings, enquiries, ledger, coupons, videos, consents, favourites, notifications,
  };
}

export const accountDate = dateOnly;
export const accountJsonLabel = jsonLabel;
