import Link from "next/link";

import type { LeadTableRow } from "@/components/admin/leads/LeadTable";
import { StatusBadge } from "@/components/admin/StatusBadge";

const columns = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"] as const;

export function LeadKanban({ rows }: { rows: LeadTableRow[] }) {
  return <section aria-label="Leads by status" className="grid gap-3 xl:grid-cols-5">
    {columns.map((status) => {
      const leads = rows.filter((lead) => lead.status === status);
      return <section key={status} aria-label={`${status} leads`} className="min-h-48 rounded-xl border border-border/70 bg-muted/30 p-3">
        <header className="mb-3 flex items-center justify-between"><StatusBadge status={status} /><span className="text-xs tabular-nums text-muted-foreground">{leads.length}</span></header>
        <ul className="grid content-start gap-2">{leads.map((lead) => <li key={lead.id} className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
          <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-forest-900 hover:underline">{lead.name ?? "Unnamed lead"}</Link>
          <p className="mt-1 text-xs text-muted-foreground">{lead.phone ?? lead.email ?? "No contact details"}</p>
          <p className="mt-2 text-xs">{lead.assignedToName ?? "Unassigned"}{lead.followUpAt ? ` · Follow-up ${lead.followUpAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}</p>
        </li>)}</ul>
        {!leads.length ? <p className="py-6 text-center text-xs text-muted-foreground">No leads</p> : null}
      </section>;
    })}
  </section>;
}
