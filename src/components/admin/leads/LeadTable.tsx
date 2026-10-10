"use client";

import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bulkLeadAction } from "@/server/actions/leads-crm";

export type LeadTableRow = {
  id: string; name: string | null; phone: string | null; email: string | null; status: string;
  closeReason: string | null; source: string | null; assignedToId: string | null; assignedToName: string | null;
  followUpAt: Date | null; createdAt: Date; _count: { enquiries: number; bookings: number };
};

export function LeadTable({ rows, page, pageCount, pageSize, assignees, actorId, canAssign, canWrite }: {
  rows: LeadTableRow[]; page: number; pageCount: number; pageSize: number;
  assignees: Array<{ id: string; name: string }>; actorId: string; canAssign: boolean; canWrite: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [targetStaff, setTargetStaff] = useState(canAssign ? "" : actorId);
  const [status, setStatus] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const column = createColumnHelper<LeadTableRow>();
  const columns = [
    column.accessor((row) => row.id, { id: "select", header: "Select", enableSorting: false, cell: ({ getValue }) => <input type="checkbox" aria-label={`Select lead ${getValue()}`} checked={selected.includes(getValue())} onChange={(event) => setSelected((current) => event.target.checked ? [...current, getValue()] : current.filter((id) => id !== getValue()))} /> }),
    column.accessor((row) => row.name ?? "Unnamed lead", { id: "name", header: "Lead", enableSorting: true, cell: ({ row }) => <Link className="font-semibold text-forest-900 underline-offset-4 hover:underline" href={`/admin/leads/${row.original.id}`}>{row.original.name ?? "Unnamed lead"}</Link> }),
    column.accessor((row) => row.phone ?? "—", { id: "phone", header: "Phone", enableSorting: false }),
    column.accessor((row) => row.email ?? "—", { id: "email", header: "Email", enableSorting: false }),
    column.accessor((row) => row.status, { id: "status", header: "Status", enableSorting: true, cell: ({ getValue }) => <StatusBadge status={getValue()} /> }),
    column.accessor((row) => row.source ?? "Unknown", { id: "source", header: "Source", enableSorting: true }),
    column.accessor((row) => row.assignedToName ?? "Unassigned", { id: "assignee", header: "Assignee", enableSorting: false }),
    column.accessor((row) => row.followUpAt?.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—", { id: "followUpAt", header: "Follow-up", enableSorting: true }),
    column.accessor((row) => row.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }), { id: "createdAt", header: "Created", enableSorting: true }),
    column.accessor((row) => `${row._count.enquiries} / ${row._count.bookings}`, { id: "activity", header: "Enquiries / Bookings", enableSorting: false }),
  ];

  async function runBulk(kind: "assign" | "status") {
    setPending(true);
    try {
      const result = await bulkLeadAction({ leadIds: selected, kind, ...(kind === "assign" ? { assignedToId: targetStaff || null } : { status, ...(status === "CLOSED" ? { closeReason } : {}), note }) });
      setMessage(result.ok ? `${result.data.updated} updated, ${result.data.skipped} skipped${result.data.reasons.length ? ` — ${result.data.reasons.join("; ")}` : ""}` : result.error.message);
      if (result.ok) setSelected([]);
    } finally { setPending(false); }
  }

  return <div className="space-y-3">
    {selected.length ? <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-end">
      <p className="text-sm font-semibold">{selected.length} selected</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs">Assign to<select value={targetStaff} onChange={(event) => setTargetStaff(event.target.value)} className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm">{canAssign ? <option value="">Unassigned</option> : null}{(!canAssign ? assignees.filter(({ id }) => id === actorId) : assignees).map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
        <ConfirmDialog trigger={<Button type="button" variant="outline" disabled={pending}>Bulk assign</Button>} title="Confirm bulk assignment" description={`Update assignment on ${selected.length} selected lead(s). Leads outside your edit scope will be skipped.`} confirmLabel="Assign" onConfirm={() => runBulk("assign")} />
        {canWrite ? <><label className="grid gap-1 text-xs">Change status<select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm"><option value="">Choose status</option>{["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {status === "CLOSED" ? <label className="grid gap-1 text-xs">Close reason<select value={closeReason} onChange={(event) => setCloseReason(event.target.value)} className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm"><option value="">Choose reason</option>{["LOST", "DUPLICATE", "SPAM", "NOT_INTERESTED", "NO_RESPONSE"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label> : null}
        <label className="grid gap-1 text-xs">Note (required to reopen)<Input maxLength={2_000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <ConfirmDialog trigger={<Button type="button" disabled={pending || !status || (status === "CLOSED" && !closeReason)}>Bulk status</Button>} title="Confirm bulk status change" description={`Attempt to move ${selected.length} selected lead(s) to ${status || "the selected status"}. Invalid or inaccessible transitions will be skipped.`} confirmLabel="Update status" onConfirm={() => runBulk("status")} /></> : null}
      </div>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </div> : null}
    <DataTable columns={columns} data={rows} page={page} pageCount={pageCount} pageSize={pageSize} emptyMessage="No leads match these filters." />
  </div>;
}
