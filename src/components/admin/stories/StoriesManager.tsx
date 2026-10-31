"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteStoryAction, reorderStoryAction, restoreStoryAction } from "@/server/actions/cms-stories";

export type StoryAdminRow = { id: string; slug: string; title: string; kind: "EXPERIENCE" | "STORY" | "GUEST"; status: string; sortOrder: number; updatedAt: string; deletedAt: string | null; publishAt: string | null; sourceConsent: boolean | null };

const kindLabel: Record<StoryAdminRow["kind"], string> = { EXPERIENCE: "Farm experience", STORY: "Story", GUEST: "Guest story" };

export function StoriesManager({ rows: initialRows, trash: initialTrash }: { rows: StoryAdminRow[]; trash: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [kind, setKind] = useState("ALL");
  const [message, setMessage] = useState("");
  const [busy, startTransition] = useTransition();
  const filtered = useMemo(() => rows.filter((row) => (!query || `${row.title} ${row.slug}`.toLowerCase().includes(query.toLowerCase())) && (status === "ALL" || row.status === status) && (kind === "ALL" || row.kind === kind)), [kind, query, rows, status]);

  function mutate(id: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) {
    startTransition(async () => { const result = await action(); setMessage(result.ok ? success : result.error?.message ?? "The action could not be completed."); if (result.ok) setRows((current) => current.filter((row) => row.id !== id)); });
  }

  return <section className="space-y-5" aria-label="Stories manager">
    <div className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
      <label className="grid gap-1 text-sm"><span className="font-medium">Search</span><input className="min-h-11 rounded-md border bg-background px-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or slug" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Status</span><select className="min-h-11 rounded-md border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option>ALL</option><option>DRAFT</option><option>SCHEDULED</option><option>PUBLISHED</option><option>ARCHIVED</option></select></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Kind</span><select className="min-h-11 rounded-md border bg-background px-3" value={kind} onChange={(event) => setKind(event.target.value)}><option>ALL</option><option value="EXPERIENCE">Farm experience</option><option value="STORY">Story</option><option value="GUEST">Guest story</option></select></label>
      <Button asChild><Link href="/admin/stories/new">Create story</Link></Button>
    </div>
    <p className="min-h-6 text-sm text-muted-foreground" role="status" aria-live="polite">{busy ? "Saving…" : message}</p>
    {filtered.length ? <div className="overflow-x-auto rounded-xl border border-border/70"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/50"><tr><th className="p-3">Story</th><th className="p-3">Kind</th><th className="p-3">Status</th><th className="p-3">Order</th><th className="p-3">Updated</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t"><td className="p-3"><Link className="font-medium text-forest-800 underline-offset-4 hover:underline" href={`/admin/stories/${row.id}`}>{row.title || row.slug}</Link><div className="text-xs text-muted-foreground">{row.slug}</div></td><td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{kindLabel[row.kind]}</span></td><td className="p-3">{row.status}{row.kind === "GUEST" && row.sourceConsent === false ? <div className="text-xs text-destructive">Consent withdrawn</div> : null}</td><td className="p-3">{row.sortOrder}</td><td className="p-3">{row.updatedAt}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/admin/stories/${row.id}`}>Edit</Link></Button>{!initialTrash ? <><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => mutate(row.id, () => reorderStoryAction({ id: row.id, direction: "up" }), "Story moved up.")}>↑</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => mutate(row.id, () => reorderStoryAction({ id: row.id, direction: "down" }), "Story moved down.")}>↓</Button><Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => { if (window.confirm("Move this story to trash?")) mutate(row.id, () => deleteStoryAction({ id: row.id }), "Story moved to trash."); }}>Trash</Button></> : <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => mutate(row.id, () => restoreStoryAction({ id: row.id }), "Story restored.")}>Restore</Button>}</div></td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{initialTrash ? "Trash is empty." : "No stories match these filters."}</div>}
  </section>;
}

