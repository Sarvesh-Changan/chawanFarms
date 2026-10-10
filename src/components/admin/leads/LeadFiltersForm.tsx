import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeadFilters } from "@/lib/schemas/leads-crm";

export function LeadFiltersForm({ filters, sources, assignees, view }: {
  filters: LeadFilters;
  sources: string[];
  assignees: Array<{ id: string; name: string }>;
  view: "list" | "kanban";
}) {
  return <form method="get" action="/admin/leads" className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
    <label className="grid gap-1 text-xs font-medium">Search name, phone or email<Input name="search" maxLength={100} defaultValue={filters.search} placeholder="Search leads" /></label>
    <label className="grid gap-1 text-xs font-medium">Statuses<select multiple name="status" defaultValue={filters.status} className="min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm">{["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-medium">Sources<select multiple name="source" defaultValue={filters.source} className="min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm">{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-medium">Assignee<select name="assigneeId" defaultValue={filters.assigneeId ?? ""} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All assignees</option><option value="unassigned">Unassigned</option>{assignees.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-medium">Created from<Input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ""} /></label>
    <label className="grid gap-1 text-xs font-medium">Created to<Input type="date" name="dateTo" defaultValue={filters.dateTo ?? ""} /></label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="followUpDue" value="true" defaultChecked={filters.followUpDue} />Follow-up due</label>
    <input type="hidden" name="view" value={view} />
    <div className="flex items-end gap-2"><Button type="submit" variant="outline">Apply</Button><Button asChild type="button" variant="ghost"><Link href="/admin/leads">Clear</Link></Button></div>
  </form>;
}
