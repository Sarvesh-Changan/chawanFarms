"use client";

import { useState, useTransition } from "react";

import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POLICY_KEYS, type PolicyKey } from "@/config/page-builder";
import { policyVersionSaveSchema } from "@/lib/schemas/cms/policies";
import { publishPolicyVersionAction, savePolicyDraftAction } from "@/server/actions/cms-policies";

type PolicyRow = { id: string; key: string; version: number; title: string; body: unknown; status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"; publishedAt: Date | null; meta: unknown };
const policyNames: Record<PolicyKey, string> = { "stay-rules-and-cancellation": "Stay rules & cancellation", cancellation: "Cancellation", privacy: "Privacy", terms: "Terms" };
function localizedBody(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const en = (value as Record<string, unknown>).en;
  return typeof en === "string" ? en : "";
}
function pendingDecision(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>).pendingDecision;
  return typeof value === "string" ? value : null;
}
function policyName(key: string): string {
  switch (key) {
    case "stay-rules-and-cancellation": return "Stay rules & cancellation";
    case "cancellation": return "Cancellation";
    case "privacy": return "Privacy";
    case "terms": return "Terms";
    default: return key;
  }
}

export function PolicyVersionManager({ rows }: { rows: PolicyRow[] }) {
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState<PolicyKey>("stay-rules-and-cancellation");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");

  function beginNewVersion(row: PolicyRow) {
    setKey(row.key as PolicyKey); setTitle(row.title); setBody(localizedBody(row.body)); setEditingId(""); setMessage(`Creating a new draft version of ${policyNames[row.key as PolicyKey]}.`);
  }
  function beginEdit(row: PolicyRow) {
    if (row.status !== "DRAFT") return;
    setKey(row.key as PolicyKey); setTitle(row.title); setBody(localizedBody(row.body)); setEditingId(row.id); setMessage(`Editing draft v${row.version}.`);
  }
  function save() {
    const parsed = policyVersionSaveSchema.safeParse({ ...(editingId ? { id: editingId } : {}), key, title, body: { en: body } });
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Review the policy text."); return; }
    startTransition(async () => {
      const result = await savePolicyDraftAction(parsed.data);
      setMessage(result.ok ? "Policy draft saved." : result.error.message);
      if (result.ok) { setEditingId(result.data.id); window.location.reload(); }
    });
  }
  function publish(id: string) {
    startTransition(async () => {
      const result = await publishPolicyVersionAction({ id });
      setMessage(result.ok ? "Policy version published." : result.error.message);
      if (result.ok) window.location.reload();
    });
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
    <section className="space-y-4">
      <h2 className="font-heading text-xl text-forest-900">Policy versions</h2>
      {rows.map((row) => <article key={row.id} className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-start gap-3"><div className="mr-auto"><h3 className="font-semibold">{policyName(row.key)} · v{row.version}</h3><p className="text-sm text-muted-foreground">{row.title} · {row.status}</p></div>{row.status === "DRAFT" ? <><Button type="button" variant="outline" onClick={() => beginEdit(row)}>Edit draft</Button><Button type="button" disabled={pending} onClick={() => publish(row.id)}>Publish</Button></> : <Button type="button" variant="outline" onClick={() => beginNewVersion(row)}>Create new version</Button>}</div>
        {pendingDecision(row.meta) ? <p className="rounded-lg border border-amber-600/30 bg-amber-50 p-3 text-sm text-amber-950">Pending client decision: {pendingDecision(row.meta)}. This version cannot be published.</p> : null}
        {row.publishedAt ? <p className="text-xs text-muted-foreground">Published {row.publishedAt.toLocaleDateString("en-IN")}. Published versions are immutable.</p> : <p className="text-xs text-muted-foreground">Draft version · not used for public policy acceptance.</p>}
      </article>)}
      {!rows.length ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No policy versions yet. Create drafts from client-approved text only.</p> : null}
    </section>
    <section className="h-fit space-y-4 rounded-2xl border border-border/70 bg-card p-5">
      <div><h2 className="font-heading text-xl text-forest-900">{editingId ? "Edit draft" : "Create a policy version"}</h2><p className="mt-1 text-sm text-muted-foreground">Published versions cannot be edited. Saving an existing version is allowed only while it is a draft.</p></div>
      <label className="grid gap-2 text-sm"><span className="font-medium">Policy type</span><select className="h-10 rounded-md border bg-background px-3" value={key} disabled={Boolean(editingId)} onChange={(event) => setKey(event.target.value as PolicyKey)}>{POLICY_KEYS.map((candidate) => <option key={candidate} value={candidate}>{policyName(candidate)}</option>)}</select></label>
      <label className="grid gap-2 text-sm"><span className="font-medium">Title</span><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160}/></label>
      <div className="grid gap-2 text-sm"><span className="font-medium">Policy text (English)</span><RichTextEditor label="Policy text (English)" value={body} onChange={setBody}/></div>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save draft"}</Button><Button type="button" variant="outline" onClick={() => { setEditingId(""); setTitle(""); setBody(""); setMessage(""); }}>Clear form</Button></div>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  </div>;
}
