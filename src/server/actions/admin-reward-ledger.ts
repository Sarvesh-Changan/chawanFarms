"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { Prisma, type LedgerType } from "@/generated/prisma/client";
import { maskEmail, sanitizeCsvCell } from "@/lib/mask";
import { err, ok, type Result } from "@/lib/result";
import { requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";

const ledgerFilterSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
    sort: z.enum(["createdAt", "points", "balanceAfter"]).default("createdAt"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    type: z.enum(["ALL", "EARN", "REDEEM", "ADJUST", "EXPIRE", "REVERSE"]).default("ALL"),
    customerSearch: z.string().trim().max(100).optional(),
    ruleVersion: z.number().int().positive().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .strict();

export type LedgerFilterInput = z.infer<typeof ledgerFilterSchema>;

export type PointsLedgerRow = {
  id: string;
  createdAt: string;
  customer: {
    id: string;
    name: string | null;
    maskedEmail: string;
  };
  type: LedgerType;
  points: number;
  balanceAfter: number;
  reason: string | null;
  ruleVersion: number | null;
  actor: {
    id: string | null;
    name: string | null;
  };
  secondApprover: {
    id: string | null;
    name: string | null;
  };
  videoSubmissionId: string | null;
  couponId: string | null;
};

export async function getPointsLedgerAction(
  rawInput: unknown,
): Promise<Result<{ rows: PointsLedgerRow[]; total: number; page: number; pageSize: number; pageCount: number }>> {
  await requireStaff();
  await requirePermission("rewards.ledger.read");

  const parsed = ledgerFilterSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return err("VALIDATION", "Invalid ledger filters", parsed.error.flatten().fieldErrors);
  }

  const { page, pageSize, sort, direction, type, customerSearch, ruleVersion, dateFrom, dateTo } = parsed.data;

  const where: Prisma.PointsLedgerWhereInput = {};

  if (type !== "ALL") {
    where.type = type;
  }

  if (ruleVersion) {
    where.rule = { version: ruleVersion };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  if (customerSearch && customerSearch.length > 0) {
    const matchingUsers = await db.user.findMany({
      where: {
        OR: [
          { name: { contains: customerSearch, mode: "insensitive" } },
          { email: { contains: customerSearch, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 100,
    });
    where.userId = { in: matchingUsers.map((u) => u.id) };
  }

  const [total, entries] = await Promise.all([
    db.pointsLedger.count({ where }),
    db.pointsLedger.findMany({
      where,
      orderBy: { [sort]: direction },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
        rule: { select: { version: true } },
      },
    }),
  ]);

  // Fetch actor details
  const actorIds = Array.from(
    new Set(
      entries.flatMap((e) => [e.actorId, e.secondApproverId]).filter((id): id is string => Boolean(id)),
    ),
  );
  const actors = actorIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a.name]));

  const rows: PointsLedgerRow[] = entries.map((entry) => ({
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    customer: {
      id: entry.user.id,
      name: entry.user.name,
      maskedEmail: maskEmail(entry.user.email),
    },
    type: entry.type,
    points: entry.points,
    balanceAfter: entry.balanceAfter,
    reason: entry.reason,
    ruleVersion: entry.rule?.version ?? null,
    actor: {
      id: entry.actorId,
      name: entry.actorId ? actorMap.get(entry.actorId) ?? "Staff" : null,
    },
    secondApprover: {
      id: entry.secondApproverId,
      name: entry.secondApproverId ? actorMap.get(entry.secondApproverId) ?? "Approver" : null,
    },
    videoSubmissionId: entry.videoSubmissionId,
    couponId: entry.couponId,
  }));

  return ok({
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  });
}

const exportLedgerFilterSchema = z
  .object({
    type: z.enum(["ALL", "EARN", "REDEEM", "ADJUST", "EXPIRE", "REVERSE"]).default("ALL"),
    customerSearch: z.string().trim().max(100).optional(),
    ruleVersion: z.number().int().positive().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .strict();

export async function exportPointsLedgerAction(
  rawInput: unknown,
): Promise<Result<{ csvContent: string; filename: string; rowCount: number }>> {
  const staff = await requireStaff();
  await requirePermission("rewards.ledger.export");

  // Rate limit: 5 exports per hour per staff member
  const limitRes = await limit(`rewards:ledger:export:${staff.id}`, 5, 3600);
  if (!limitRes.allowed) {
    return err(
      "CONFLICT",
      `Export limit reached. You can perform at most 5 ledger exports per hour. Please retry after ${limitRes.retryAfterSeconds} seconds.`,
    );
  }

  const parsed = exportLedgerFilterSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return err("VALIDATION", "Invalid export filters");
  }

  const { type, customerSearch, ruleVersion, dateFrom, dateTo } = parsed.data;

  const where: Prisma.PointsLedgerWhereInput = {};
  if (type !== "ALL") where.type = type;
  if (ruleVersion) where.rule = { version: ruleVersion };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  if (customerSearch && customerSearch.length > 0) {
    const matchingUsers = await db.user.findMany({
      where: {
        OR: [
          { name: { contains: customerSearch, mode: "insensitive" } },
          { email: { contains: customerSearch, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 100,
    });
    where.userId = { in: matchingUsers.map((u) => u.id) };
  }

  const entries = await db.pointsLedger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      user: { select: { id: true, email: true } },
      rule: { select: { version: true } },
    },
  });

  const actorIds = Array.from(
    new Set(entries.map((e) => e.actorId).filter((id): id is string => Boolean(id))),
  );
  const actors = actorIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a.name ?? "Staff"]));

  // CSV Header
  const headersRow = [
    "Date",
    "Customer ID",
    "Customer Email",
    "Type",
    "Points",
    "Balance After",
    "Reason",
    "Rule Version",
    "Actor Name",
  ];

  const rows = entries.map((e) => [
    sanitizeCsvCell(e.createdAt.toISOString()),
    sanitizeCsvCell(e.userId),
    sanitizeCsvCell(maskEmail(e.user.email)),
    sanitizeCsvCell(e.type),
    sanitizeCsvCell(e.points),
    sanitizeCsvCell(e.balanceAfter),
    sanitizeCsvCell(e.reason ?? ""),
    sanitizeCsvCell(e.rule?.version ?? ""),
    sanitizeCsvCell(e.actorId ? actorMap.get(e.actorId) ?? "Staff" : ""),
  ]);

  const csvContent = [headersRow.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `points-ledger-${staff.id}-${timestamp}.csv`;

  // Audit: filters used and row count, NO customer PII in audit
  const requestHeaders = await headers();
  await audit({
    actor: { id: staff.id, type: "STAFF" },
    action: "rewards.ledger.export",
    entityType: "PointsLedger",
    entityId: staff.id,
    after: {
      filtersUsed: {
        type,
        customerSearch: customerSearch ? "[FILTERED]" : undefined,
        ruleVersion,
        dateFrom,
        dateTo,
      },
      rowCount: entries.length,
      filename,
    },
    ip: requestHeaders.get("cf-connecting-ip") ?? "unknown",
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });

  return ok({ csvContent, filename, rowCount: entries.length });
}
