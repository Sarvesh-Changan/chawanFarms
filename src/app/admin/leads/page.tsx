import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadFiltersForm } from "@/components/admin/leads/LeadFiltersForm";
import { LeadKanban } from "@/components/admin/leads/LeadKanban";
import { LeadTable } from "@/components/admin/leads/LeadTable";
import { SavedLeadFilters } from "@/components/admin/leads/SavedLeadFilters";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { leadFilterSchema, leadListQuerySchema } from "@/lib/schemas/leads-crm";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { getSavedLeadFilter, listLeads, listSavedLeadFilters } from "@/server/services/leads-crm";

function queryString(filters: { status: string[]; source: string[]; assigneeId?: string; dateFrom?: string; dateTo?: string; followUpDue: boolean; search: string }, view: string, includeView = true) {
  const params = new URLSearchParams();
  if (includeView) params.set("view", view);
  for (const status of filters.status) params.append("status", status);
  for (const source of filters.source) params.append("source", source);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.followUpDue) params.set("followUpDue", "true");
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export default async function AdminLeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff) return <NoAccess title="Staff access required" />;
  try { await requirePermission("leads.read"); }
  catch (error) { return <NoAccess title={error instanceof AuthorizationError && !staff.twoFactorEnabled ? "Set up two-factor authentication" : "Lead access required"} message="Your staff role does not have permission to view the CRM." />; }

  const raw = await searchParams;
  const parsedQuery = leadListQuerySchema.safeParse(raw);
  if (!parsedQuery.success) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">Invalid CRM filters. Clear filters and try again.</div>;
  const query = parsedQuery.data;
  const parsedFilters = leadFilterSchema.safeParse({ status: query.status, source: query.source, assigneeId: query.assigneeId, dateFrom: query.dateFrom, dateTo: query.dateTo, followUpDue: query.followUpDue, search: query.search });
  if (!parsedFilters.success) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">Invalid filter values. Clear filters and try again.</div>;
  let filters = parsedFilters.data;
  if (query.filterId) {
    const saved = await getSavedLeadFilter(query.filterId, staff.id);
    if (!saved) notFound();
    const safe = leadFilterSchema.safeParse(saved.filters);
    if (!safe.success) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">This saved filter is invalid. Delete it and create a new one.</div>;
    filters = safe.data;
  }
  const [result, saved, canAssign, canWrite] = await Promise.all([
    listLeads({ filters, page: query.page, pageSize: query.pageSize, sort: query.sort, direction: query.direction }),
    listSavedLeadFilters(staff.id),
    can(staff, "leads.assign"),
    can(staff, "leads.write"),
  ]);
  const exportQuery = queryString(filters, query.view, false);
  const listHref = `/admin/leads?${queryString(filters, "list")}`;
  const kanbanHref = `/admin/leads?${queryString(filters, "kanban")}`;

  return <div className="space-y-6">
    <PageHeader eyebrow="Customer relationship management" title="Leads" description="Review enquiries, follow-ups and the lead pipeline." actions={<><Button asChild variant="outline"><Link href={listHref}>List</Link></Button><Button asChild variant="outline"><Link href={kanbanHref}>Kanban</Link></Button>{await can(staff, "leads.export") ? <Button asChild><a href={`/api/admin/export/leads${exportQuery ? `?${exportQuery}` : ""}`}>Export CSV</a></Button> : null}</>} />
    <SavedLeadFilters filters={filters} saved={saved.map(({ id, name, filters: value }) => ({ id, name, filters: value }))} />
    <LeadFiltersForm filters={filters} sources={result.sources} assignees={result.assignees} view={query.view} />
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{result.total} matching leads</p><p className="text-xs text-muted-foreground">Page {result.page} of {result.pageCount}</p></div>
    {query.view === "kanban" ? <><LeadKanban rows={result.rows} /><nav aria-label="Kanban pages" className="flex justify-end gap-2"><Button asChild variant="outline" disabled={result.page <= 1}><Link href={`/admin/leads?${queryString(filters, "kanban")}&page=${Math.max(1, result.page - 1)}`}>Previous</Link></Button><Button asChild variant="outline" disabled={result.page >= result.pageCount}><Link href={`/admin/leads?${queryString(filters, "kanban")}&page=${Math.min(result.pageCount, result.page + 1)}`}>Next</Link></Button></nav></> : <LeadTable rows={result.rows} page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} assignees={result.assignees} actorId={staff.id} canAssign={canAssign} canWrite={canWrite} />}
  </div>;
}
