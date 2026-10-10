import { NextResponse } from "next/server";

import { toCsv } from "@/lib/csv";
import { leadExportQuerySchema } from "@/lib/schemas/leads-crm";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { leadWhere } from "@/server/services/leads-crm";

export async function GET(request: Request) {
  let staff;
  try {
    staff = await requirePermission("leads.export");
  } catch (error) {
    const status = error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Sign in required." : "Export permission required." }, { status });
  }
  if (!("id" in staff)) return NextResponse.json({ error: "Export permission required." }, { status: 403 });
  const url = new URL(request.url);
  const allowedParameters = new Set(["status", "source", "assigneeId", "dateFrom", "dateTo", "followUpDue", "search"]);
  if ([...url.searchParams.keys()].some((key) => !allowedParameters.has(key))) return NextResponse.json({ error: "Invalid export filters." }, { status: 400 });
  const followUpValue = url.searchParams.get("followUpDue");
  if (followUpValue !== null && !["true", "false", "1", "0"].includes(followUpValue)) return NextResponse.json({ error: "Invalid export filters." }, { status: 400 });
  const candidate = {
    status: url.searchParams.getAll("status"),
    source: url.searchParams.getAll("source"),
    assigneeId: url.searchParams.get("assigneeId") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    followUpDue: followUpValue === "true" || followUpValue === "1",
    search: url.searchParams.get("search") ?? "",
  };
  const parsed = leadExportQuerySchema.safeParse(candidate);
  if (!parsed.success) return NextResponse.json({ error: "Invalid export filters." }, { status: 400 });
  try {
    const rate = await limit(`admin-export:leads:${staff.id}`, 5, 3_600);
    if (!rate.allowed) return NextResponse.json({ error: "Export limit reached." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    const where = leadWhere(parsed.data);
    const rows: unknown[][] = [["id", "name", "phone", "email", "status", "closeReason", "source", "assignedToId", "followUpAt", "createdAt", "firstUtmSource", "firstUtmMedium", "firstUtmCampaign", "utmSource", "utmMedium", "utmCampaign", "firstReferrer", "lastReferrer", "firstLandingPath", "lastLandingPath"]];
    let offset = 0;
    const chunkSize = 1_000;
    while (true) {
      const batch = await db.lead.findMany({ where, skip: offset, take: chunkSize, orderBy: { createdAt: "desc" }, select: { id: true, name: true, phone: true, email: true, status: true, closeReason: true, source: true, assignedToId: true, followUpAt: true, createdAt: true, firstUtmSource: true, firstUtmMedium: true, firstUtmCampaign: true, utmSource: true, utmMedium: true, utmCampaign: true, firstReferrer: true, lastReferrer: true, firstLandingPath: true, lastLandingPath: true } });
      if (batch.length === 0) break;
      rows.push(...batch.map((lead) => Object.values(lead).map((value) => value instanceof Date ? value.toISOString() : value)));
      offset += batch.length;
      if (batch.length < chunkSize) break;
    }
    const nonPiiFilters = { status: parsed.data.status, source: parsed.data.source, assigneeId: parsed.data.assigneeId, dateFrom: parsed.data.dateFrom, dateTo: parsed.data.dateTo, followUpDue: parsed.data.followUpDue };
    const logged = await audit({ actor: { id: staff.id, type: "STAFF" }, action: "lead.export", entityType: "Lead", after: { rowCount: rows.length - 1, filters: nonPiiFilters, searchApplied: Boolean(parsed.data.search) }, ip: request.headers.get("cf-connecting-ip")?.slice(0, 128) ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 128), userAgent: request.headers.get("user-agent")?.slice(0, 512), requestId: request.headers.get("x-request-id")?.slice(0, 128) });
    if (!logged.ok) return NextResponse.json({ error: "Export audit logging failed." }, { status: 503 });
    return new Response(`\uFEFF${toCsv(rows)}`, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Lead export is temporarily unavailable." }, { status: 503 });
  }
}
