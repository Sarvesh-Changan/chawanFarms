import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

function kolkataStartOfDay(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), -5, -30));
}

export async function getAdminDashboardData(now = new Date(), includeAudit = true, includeLeads = true) {
  const today = kolkataStartOfDay(now);
  const sevenDaysAgo = new Date(today.getTime() - 6 * 86_400_000);
  const thirtyDaysAgo = new Date(today.getTime() - 29 * 86_400_000);

  const [leadsToday, leadsSevenDays, leadsThirtyDays, enquiriesByLeadStatus, bookingsByStatus, pendingVideos, recentAudit, rewards] = await Promise.all([
    includeLeads ? db.lead.count({ where: { deletedAt: null, createdAt: { gte: today } } }) : Promise.resolve(0),
    includeLeads ? db.lead.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }) : Promise.resolve(0),
    includeLeads ? db.lead.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }) : Promise.resolve(0),
    db.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT lead."status"::text AS status, COUNT(enquiry."id")::bigint AS count
      FROM "Enquiry" AS enquiry
      INNER JOIN "Lead" AS lead ON lead."id" = enquiry."leadId"
      WHERE lead."deletedAt" IS NULL
      GROUP BY lead."status"
      ORDER BY lead."status"
    `,
    db.booking.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    db.videoSubmission.count({ where: { status: "PENDING" } }),
    includeAudit ? db.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, entityType: true, entityId: true, actorId: true, createdAt: true },
    }) : Promise.resolve([]),
    getRewardDashboardMetrics(30, now),
  ]);

  return {
    leads: { today: leadsToday, sevenDays: leadsSevenDays, thirtyDays: leadsThirtyDays },
    enquiriesByLeadStatus: enquiriesByLeadStatus.map(({ status, count }) => ({ status, count: Number(count) })),
    bookingsByStatus: bookingsByStatus.map(({ status, _count }) => ({ status, count: _count._all })),
    pendingVideos,
    recentAudit,
    rewards,
    generatedAt: now.toISOString(),
  };
}

export type RewardDashboardMetrics = {
  rangeDays: number;
  pointsIssued: number;
  pointsRedeemed: number;
  pointsExpired: number;
  pointsReversed: number;
  activeCoupons: number;
  couponsIssuedInRange: number;
  couponsRedeemedInRange: number;
  redemptionRate: number;
};

export async function getRewardDashboardMetrics(
  days = 30,
  now = new Date(),
): Promise<RewardDashboardMetrics> {
  const rangeStart = new Date(now.getTime() - days * 86_400_000);

  const pointsAgg = await db.$queryRaw<
    Array<{
      type: string;
      total_positive: bigint;
      total_negative: bigint;
      total_abs: bigint;
    }>
  >`
    SELECT
      "type"::text AS "type",
      COALESCE(SUM(CASE WHEN "points" > 0 THEN "points" ELSE 0 END), 0)::bigint AS "total_positive",
      COALESCE(SUM(CASE WHEN "points" < 0 THEN "points" ELSE 0 END), 0)::bigint AS "total_negative",
      COALESCE(SUM(ABS("points")), 0)::bigint AS "total_abs"
    FROM "PointsLedger"
    WHERE "createdAt" >= ${rangeStart}
    GROUP BY "type"
  `;

  let pointsIssued = 0;
  let pointsRedeemed = 0;
  let pointsExpired = 0;
  let pointsReversed = 0;

  for (const row of pointsAgg) {
    if (row.type === "EARN" || row.type === "ADJUST") {
      pointsIssued += Number(row.total_positive);
    }
    if (row.type === "REDEEM") {
      pointsRedeemed += Number(row.total_abs);
    }
    if (row.type === "EXPIRE") {
      pointsExpired += Number(row.total_abs);
    }
    if (row.type === "REVERSE") {
      pointsReversed += Number(row.total_abs);
    }
  }

  const [activeCoupons, couponsIssuedInRange, couponsRedeemedInRange] = await Promise.all([
    db.coupon.count({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
    }),
    db.coupon.count({
      where: {
        issuedAt: { gte: rangeStart },
      },
    }),
    db.coupon.count({
      where: {
        issuedAt: { gte: rangeStart },
        redemptions: {
          some: {
            releasedAt: null,
          },
        },
      },
    }),
  ]);

  const redemptionRate =
    couponsIssuedInRange > 0
      ? Math.round((couponsRedeemedInRange / couponsIssuedInRange) * 1000) / 10
      : 0;

  return {
    rangeDays: days,
    pointsIssued,
    pointsRedeemed,
    pointsExpired,
    pointsReversed,
    activeCoupons,
    couponsIssuedInRange,
    couponsRedeemedInRange,
    redemptionRate,
  };
}

export async function listStaff(page: number, pageSize: number, query: string, sort = "createdAt", direction: "asc" | "desc" = "desc") {
  const where: Prisma.UserWhereInput = {
    type: "STAFF",
    status: { not: "PENDING_DELETION" },
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {}),
  };
  const orderBy: Prisma.UserOrderByWithRelationInput = sort === "name" ? { name: direction } : sort === "status" ? { status: direction } : { createdAt: direction };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        twoFactorEnabled: true,
        createdAt: true,
        staffRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    }),
    db.user.count({ where }),
  ]);
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listRoles() {
  return db.role.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { staff: true } },
    },
  });
}

export async function listAudit(page: number, pageSize: number, filters: { action?: string; entityType?: string; actorId?: string }, sort = "createdAt", direction: "asc" | "desc" = "desc") {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" } } : {}),
    ...(filters.entityType ? { entityType: { contains: filters.entityType, mode: "insensitive" } } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
  };
  const orderBy: Prisma.AuditLogOrderByWithRelationInput = sort === "action" ? { action: direction } : { createdAt: direction };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      select: { id: true, actorId: true, actorType: true, action: true, entityType: true, entityId: true, before: true, after: true, ip: true, requestId: true, createdAt: true },
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listCurrentUserSessions(userId: string) {
  return db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
  });
}

export async function listPendingStaffInvites() {
  return db.staffInvite.findMany({
    where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, email: true, expiresAt: true, createdAt: true, invitedById: true },
  });
}

export async function listPermissions() {
  return db.permission.findMany({ orderBy: { key: "asc" }, select: { id: true, key: true, description: true } });
}
