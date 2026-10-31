import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AdminEnquiryFilters } from "@/lib/schemas/admin-enquiries";
import { db } from "@/server/db";

export type AdminEnquiryItem = {
  id: string;
  reference: string;
  type: string;
  message: string | null;
  preferredStart: Date | null;
  preferredEnd: Date | null;
  adults: number | null;
  children: number | null;
  infants: number | null;
  groupSize: number | null;
  consentToContact: boolean;
  pagePath: string | null;
  createdAt: Date;
  packageId: string | null;
  activityId: string | null;
  accommodationId: string | null;
  package: { id: string; name: unknown; slug: string } | null;
  activity: { id: string; name: unknown; slug: string } | null;
  accommodation: { id: string; name: unknown; slug: string } | null;
  assigneeName: string | null;
  lead: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    status: string;
    closeReason: string | null;
    source: string | null;
    assignedToId: string | null;
  };
};

export type AdminEnquiriesResult = {
  enquiries: AdminEnquiryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    total: number;
    newCount: number;
    packages: number;
    groups: number;
  };
};

export async function listAdminEnquiries(filters: AdminEnquiryFilters): Promise<AdminEnquiriesResult> {
  const where: Prisma.EnquiryWhereInput = {};

  if (filters.search) {
    const q = filters.search;
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
      { lead: { name: { contains: q, mode: "insensitive" } } },
      { lead: { phone: { contains: q } } },
      { lead: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (filters.type && filters.type !== "ALL") {
    where.type = filters.type;
  }

  if (filters.status && filters.status !== "ALL") {
    where.lead = {
      is: {
        status: filters.status,
      },
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) {
      dateFilter.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      dateFilter.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
    }
    where.createdAt = dateFilter;
  }

  const [totalCount, items, summaryTotal, summaryNew, summaryPackages, summaryGroups] = await Promise.all([
    db.enquiry.count({ where }),
    db.enquiry.findMany({
      where,
      orderBy: { createdAt: filters.sortOrder },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            closeReason: true,
            source: true,
            assignedToId: true,
          },
        },
      },
    }),
    db.enquiry.count(),
    db.enquiry.count({ where: { lead: { status: "NEW" } } }),
    db.enquiry.count({ where: { type: "PACKAGE" } }),
    db.enquiry.count({ where: { type: { in: ["CAMP_ORGANISER", "SCHOOL_GROUP"] } } }),
  ]);

  const packageIds = [...new Set(items.map((i) => i.packageId).filter((id): id is string => Boolean(id)))];
  const activityIds = [...new Set(items.map((i) => i.activityId).filter((id): id is string => Boolean(id)))];
  const accommodationIds = [...new Set(items.map((i) => i.accommodationId).filter((id): id is string => Boolean(id)))];
  const assignedToIds = [...new Set(items.map((i) => i.lead?.assignedToId).filter((id): id is string => Boolean(id)))];

  const [packages, activities, accommodations, staffUsers] = await Promise.all([
    packageIds.length ? db.package.findMany({ where: { id: { in: packageIds } }, select: { id: true, name: true, slug: true } }) : [],
    activityIds.length ? db.activity.findMany({ where: { id: { in: activityIds } }, select: { id: true, name: true, slug: true } }) : [],
    accommodationIds.length ? db.accommodation.findMany({ where: { id: { in: accommodationIds } }, select: { id: true, name: true, slug: true } }) : [],
    assignedToIds.length ? db.user.findMany({ where: { id: { in: assignedToIds } }, select: { id: true, name: true } }) : [],
  ]);

  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const activityMap = new Map(activities.map((a) => [a.id, a]));
  const accommodationMap = new Map(accommodations.map((acc) => [acc.id, acc]));
  const staffMap = new Map(staffUsers.map((s) => [s.id, s.name]));

  const enquiries: AdminEnquiryItem[] = items.map((item) => ({
    ...item,
    package: item.packageId ? packageMap.get(item.packageId) ?? null : null,
    activity: item.activityId ? activityMap.get(item.activityId) ?? null : null,
    accommodation: item.accommodationId ? accommodationMap.get(item.accommodationId) ?? null : null,
    assigneeName: item.lead?.assignedToId ? staffMap.get(item.lead.assignedToId) ?? null : null,
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  return {
    enquiries,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages,
    summary: {
      total: summaryTotal,
      newCount: summaryNew,
      packages: summaryPackages,
      groups: summaryGroups,
    },
  };
}
