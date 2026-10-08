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

export async function getAdminDashboardData(now = new Date(), includeAudit = true) {
  const today = kolkataStartOfDay(now);
  const sevenDaysAgo = new Date(today.getTime() - 6 * 86_400_000);
  const thirtyDaysAgo = new Date(today.getTime() - 29 * 86_400_000);

  const [leadsToday, leadsSevenDays, leadsThirtyDays, enquiriesByLeadStatus, bookingsByStatus, pendingVideos, recentAudit] = await Promise.all([
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
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
  ]);

  return {
    leads: { today: leadsToday, sevenDays: leadsSevenDays, thirtyDays: leadsThirtyDays },
    enquiriesByLeadStatus: enquiriesByLeadStatus.map(({ status, count }) => ({ status, count: Number(count) })),
    bookingsByStatus: bookingsByStatus.map(({ status, _count }) => ({ status, count: _count._all })),
    pendingVideos,
    recentAudit,
    generatedAt: now.toISOString(),
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
