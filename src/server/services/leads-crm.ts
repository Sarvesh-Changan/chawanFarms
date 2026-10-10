import "server-only";

import { Prisma, type LeadCloseReason, type LeadStatus } from "@/generated/prisma/client";
import type { LeadFilters } from "@/lib/schemas/leads-crm";
import { db } from "@/server/db";
import { canEditLeadScope, canTransitionLeadStatus, type LeadStatusValue } from "@/server/policies/leadStatus";

export const SAVED_LEAD_FILTER_SCOPE = "leads";
export const MAX_SAVED_FILTERS_PER_SCOPE = 20;

export class LeadCrmError extends Error {
  constructor(readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "VALIDATION" | "UNAVAILABLE", message: string) {
    super(message);
    this.name = "LeadCrmError";
  }
}

export type LeadActor = { id: string; canAssign: boolean };

function kolkataDateStart(value: string): Date {
  return new Date(`${value}T00:00:00+05:30`);
}

function kolkataDateString(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function leadWhere(filters: LeadFilters): Prisma.LeadWhereInput {
  const endOfToday = new Date(kolkataDateStart(kolkataDateString(new Date())).getTime() + 86_400_000 - 1);
  return {
    deletedAt: null,
    ...(filters.search ? { OR: [
      { name: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ] } : {}),
    ...(filters.status.length ? { status: { in: filters.status as LeadStatus[] } } : {}),
    ...(filters.source.length ? { source: { in: filters.source } } : {}),
    ...(filters.assigneeId ? { assignedToId: filters.assigneeId === "unassigned" ? null : filters.assigneeId } : {}),
    ...(filters.dateFrom || filters.dateTo ? { createdAt: {
      ...(filters.dateFrom ? { gte: kolkataDateStart(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lt: new Date(kolkataDateStart(filters.dateTo).getTime() + 86_400_000) } : {}),
    } } : {}),
    ...(filters.followUpDue ? { followUpAt: { lte: endOfToday } } : {}),
  };
}

export async function listLeads(input: { filters: LeadFilters; page: number; pageSize: number; sort: "name" | "status" | "createdAt" | "followUpAt" | "source"; direction: "asc" | "desc" }) {
  const where = leadWhere(input.filters);
  const orderBy: Prisma.LeadOrderByWithRelationInput = input.sort === "name" ? { name: input.direction } : input.sort === "status" ? { status: input.direction } : input.sort === "followUpAt" ? { followUpAt: input.direction } : input.sort === "source" ? { source: input.direction } : { createdAt: input.direction };
  const [rows, total, sources, assignees] = await Promise.all([
    db.lead.findMany({
      where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy,
      select: { id: true, name: true, phone: true, email: true, status: true, closeReason: true, source: true, assignedToId: true, followUpAt: true, createdAt: true, _count: { select: { enquiries: true, bookings: true } } },
    }),
    db.lead.count({ where }),
    db.lead.findMany({ where: { deletedAt: null, source: { not: null } }, distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
    db.user.findMany({ where: { type: "STAFF", status: "ACTIVE", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const assignedIds = [...new Set(rows.flatMap((row) => row.assignedToId ? [row.assignedToId] : []))];
  const assignedUsers = assignedIds.length ? await db.user.findMany({ where: { id: { in: assignedIds } }, select: { id: true, name: true } }) : [];
  const staffById = new Map(assignedUsers.map((user) => [user.id, user.name]));
  return {
    rows: rows.map((row) => ({ ...row, assignedToName: row.assignedToId ? staffById.get(row.assignedToId) ?? "Disabled staff" : null })),
    total, page: input.page, pageSize: input.pageSize, pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    sources: sources.flatMap(({ source }) => source ? [source] : []),
    assignees,
  };
}

export async function getLeadDetail(id: string) {
  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 200 },
      notes: { orderBy: { createdAt: "desc" }, take: 100 },
      enquiries: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { createdAt: "desc" }, select: { id: true, reference: true, status: true, checkIn: true, checkOut: true, totalPaise: true, createdAt: true } },
    },
  });
  if (!lead) return null;
  const authorIds = [...new Set(lead.notes.map(({ authorId }) => authorId))];
  const authors = authorIds.length ? await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } }) : [];
  const assignedTo = lead.assignedToId ? await db.user.findUnique({ where: { id: lead.assignedToId }, select: { id: true, name: true } }) : null;
  const staff = await db.user.findMany({ where: { type: "STAFF", status: "ACTIVE", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return { ...lead, assignedTo, staff, authors: Object.fromEntries(authors.map(({ id: authorId, name }) => [authorId, name])) };
}

async function lockedLead(tx: Prisma.TransactionClient, leadId: string, actor: LeadActor) {
  const records = await tx.$queryRaw<Array<{ id: string; assignedToId: string | null; status: LeadStatus; closeReason: LeadCloseReason | null; followUpAt: Date | null }>>(Prisma.sql`
    SELECT "id", "assignedToId", "status", "closeReason", "followUpAt" FROM "Lead"
    WHERE "id" = ${leadId} AND "deletedAt" IS NULL FOR UPDATE
  `);
  const lead = records[0];
  if (!lead) throw new LeadCrmError("NOT_FOUND", "Lead not found.");
  if (!canEditLeadScope({ assignedToId: lead.assignedToId, actorId: actor.id, canAssign: actor.canAssign })) throw new LeadCrmError("FORBIDDEN", "This lead is assigned to another staff member.");
  return lead;
}

export async function changeLeadStatus(input: { leadId: string; status: LeadStatusValue; closeReason?: LeadCloseReason; note?: string }, actor: LeadActor) {
  return db.$transaction(async (tx) => {
    const before = await lockedLead(tx, input.leadId, actor);
    if (!canTransitionLeadStatus(before.status, input.status, { canAssign: actor.canAssign, note: input.note })) throw new LeadCrmError("CONFLICT", "That lead status transition is not allowed.");
    if (input.status === "CLOSED" && !input.closeReason) throw new LeadCrmError("VALIDATION", "A close reason is required.");
    if (before.status === "CLOSED" && input.status === "CONTACTED" && !input.note?.trim()) throw new LeadCrmError("VALIDATION", "Add a note when reopening a closed lead.");
    const now = new Date();
    const after = await tx.lead.update({ where: { id: input.leadId }, data: {
      status: input.status,
      closeReason: input.status === "CLOSED" ? input.closeReason : null,
      ...(input.status === "CONVERTED" ? { convertedAt: now } : {}),
      ...(input.status === "CLOSED" ? { closedAt: now } : {}),
      ...(before.status === "CLOSED" && input.status === "CONTACTED" ? { closedAt: null, closeReason: null } : {}),
    }, select: { id: true, status: true, closeReason: true, convertedAt: true, closedAt: true, assignedToId: true } });
    const reopening = before.status === "CLOSED" && input.status === "CONTACTED";
    const noteBody = input.note?.trim();
    if (reopening && !noteBody) throw new LeadCrmError("VALIDATION", "Add a note when reopening a closed lead.");
    const reopenNote = reopening && noteBody ? await tx.leadNote.create({ data: { leadId: input.leadId, authorId: actor.id, body: noteBody }, select: { id: true } }) : null;
    await tx.leadEvent.create({ data: { leadId: input.leadId, type: "STATUS_CHANGE", meta: { from: before.status, to: input.status, closeReason: input.closeReason ?? null, ...(reopenNote ? { noteId: reopenNote.id } : {}) } } });
    return { before, after };
  });
}

export async function addLeadNote(input: { leadId: string; body: string }, actor: LeadActor) {
  return db.$transaction(async (tx) => {
    await lockedLead(tx, input.leadId, actor);
    const note = await tx.leadNote.create({ data: { leadId: input.leadId, authorId: actor.id, body: input.body }, select: { id: true, body: true, createdAt: true } });
    await tx.leadEvent.create({ data: { leadId: input.leadId, type: "NOTE_ADDED", meta: { noteId: note.id } } });
    return note;
  });
}

export async function setLeadFollowUp(input: { leadId: string; followUpAt: string }, actor: LeadActor) {
  return db.$transaction(async (tx) => {
    const before = await lockedLead(tx, input.leadId, actor);
    const followUpAt = input.followUpAt ? new Date(input.followUpAt) : null;
    const after = await tx.lead.update({ where: { id: input.leadId }, data: { followUpAt }, select: { id: true, followUpAt: true } });
    await tx.leadEvent.create({ data: { leadId: input.leadId, type: "FOLLOW_UP_CHANGE", meta: { from: before.followUpAt?.toISOString() ?? null, to: followUpAt?.toISOString() ?? null } } });
    return { before: before.followUpAt, after };
  });
}

export async function setLeadAssignment(input: { leadId: string; assignedToId: string | null }, actor: LeadActor) {
  return db.$transaction(async (tx) => {
    const before = await lockedLead(tx, input.leadId, actor);
    if (input.assignedToId !== actor.id && !actor.canAssign) throw new LeadCrmError("FORBIDDEN", "Only leads.assign staff can assign a lead to another staff member or unassign it.");
    if (input.assignedToId) {
      const target = await tx.user.findFirst({ where: { id: input.assignedToId, type: "STAFF", status: "ACTIVE", deletedAt: null }, select: { id: true } });
      if (!target) throw new LeadCrmError("VALIDATION", "Choose an active staff member.");
    }
    const after = await tx.lead.update({ where: { id: input.leadId }, data: { assignedToId: input.assignedToId }, select: { id: true, assignedToId: true } });
    await tx.leadEvent.create({ data: { leadId: input.leadId, type: "ASSIGNMENT_CHANGE", meta: { from: before.assignedToId, to: input.assignedToId } } });
    return { before: before.assignedToId, after };
  });
}

export async function saveLeadFilter(input: { name: string; filters: LeadFilters }, userId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`saved-filter:${userId}:${SAVED_LEAD_FILTER_SCOPE}`}, 0))`);
    const duplicate = await tx.savedFilter.findFirst({ where: { userId, scope: SAVED_LEAD_FILTER_SCOPE, name: { equals: input.name, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) throw new LeadCrmError("CONFLICT", "A saved filter with that name already exists.");
    const count = await tx.savedFilter.count({ where: { userId, scope: SAVED_LEAD_FILTER_SCOPE } });
    if (count >= MAX_SAVED_FILTERS_PER_SCOPE) throw new LeadCrmError("CONFLICT", `You can save up to ${MAX_SAVED_FILTERS_PER_SCOPE} lead filters.`);
    return tx.savedFilter.create({ data: { userId, scope: SAVED_LEAD_FILTER_SCOPE, name: input.name, filters: input.filters as Prisma.InputJsonValue }, select: { id: true, name: true, filters: true, createdAt: true } });
  });
}

export async function listSavedLeadFilters(userId: string) {
  return db.savedFilter.findMany({ where: { userId, scope: SAVED_LEAD_FILTER_SCOPE }, orderBy: { name: "asc" }, select: { id: true, name: true, filters: true, createdAt: true } });
}

export async function getSavedLeadFilter(id: string, userId: string) {
  return db.savedFilter.findFirst({ where: { id, userId, scope: SAVED_LEAD_FILTER_SCOPE }, select: { id: true, name: true, filters: true } });
}

export async function deleteSavedLeadFilter(id: string, userId: string) {
  const result = await db.savedFilter.deleteMany({ where: { id, userId, scope: SAVED_LEAD_FILTER_SCOPE } });
  return result.count === 1;
}

export async function getLeadDashboardWidgets(now = new Date()) {
  const today = kolkataDateStart(kolkataDateString(now));
  const start = new Date(today.getTime() - 29 * 86_400_000);
  const [dailyRows, sourceRows, statusRows] = await Promise.all([
    db.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
      FROM "Lead" WHERE "deletedAt" IS NULL AND "createdAt" >= ${start}
      GROUP BY day ORDER BY day
    `),
    db.lead.groupBy({ by: ["source"], where: { deletedAt: null }, _count: { _all: true }, orderBy: { _count: { id: "desc" } } }),
    db.lead.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const dailyByDate = new Map(dailyRows.map(({ day, count }) => [day, Number(count)]));
  const days = Array.from({ length: 30 }, (_, index) => {
    const day = kolkataDateString(new Date(start.getTime() + index * 86_400_000));
    return { day, count: dailyByDate.get(day) ?? 0 };
  });
  const statuses = new Map(statusRows.map(({ status, _count }) => [status, _count._all]));
  return {
    days,
    sources: sourceRows.map(({ source, _count }) => ({ source: source ?? "Unknown", count: _count._all })).sort((a, b) => b.count - a.count),
    funnel: (["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"] as const).map((status) => ({ status, count: statuses.get(status) ?? 0 })),
  };
}
