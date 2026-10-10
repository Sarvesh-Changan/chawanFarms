"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeadFilters } from "@/lib/schemas/leads-crm";
import { deleteLeadFilterAction, saveLeadFilterAction } from "@/server/actions/leads-crm";

type Saved = { id: string; name: string; filters: unknown };

export function SavedLeadFilters({ filters, saved }: { filters: LeadFilters; saved: Saved[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function save() {
    startTransition(async () => {
      const result = await saveLeadFilterAction({ name, filters });
      setMessage(result.ok ? "Filter saved." : result.error.message);
      if (result.ok) { setName(""); router.refresh(); }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteLeadFilterAction({ id });
      setMessage(result.ok ? "Saved filter deleted." : result.error.message);
      if (result.ok) router.refresh();
    });
  }
  return <section aria-label="Saved filters" className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 lg:flex-row lg:items-end lg:justify-between">
    <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-medium">Save current filters<Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="My follow-ups" /></label><Button type="button" variant="outline" disabled={pending || !name.trim()} onClick={save}>Save view</Button></div>
    <div className="flex flex-wrap gap-2">{saved.map((filter) => <div key={filter.id} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1"><Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/admin/leads?filterId=${encodeURIComponent(filter.id)}`)}>{filter.name}</Button><Button type="button" variant="ghost" size="sm" aria-label={`Delete saved filter ${filter.name}`} disabled={pending} onClick={() => remove(filter.id)}>×</Button></div>)}</div>
    {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
  </section>;
}
