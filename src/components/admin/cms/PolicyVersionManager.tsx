"use client";

import { useState, useTransition } from "react";

import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POLICY_KEYS, type PolicyKey } from "@/config/page-builder";
import { policyVersionSaveSchema } from "@/lib/schemas/cms/policies";
import { publishPolicyVersionAction, savePolicyDraftAction } from "@/server/actions/cms-policies";

type PolicyRow = { id: string; key: string; title: string; body: unknown; status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"; publishedAt: Date | null; meta: unknown };
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
  return key in policyNames ? policyNames[key as PolicyKey] : key;
}

export function PolicyVersionManager({ rows }: { rows: PolicyRow[] }) {
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState<PolicyKey>("stay-rules-and-cancellation");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");

  function beginEdit(row: PolicyRow) {
    setKey(row.key as PolicyKey);
    setTitle(row.title);
    setBody(localizedBody(row.body));
    setEditingId(row.id);
    setMessage(`Editing ${policyName(row.key)}.`);
  }

  function save() {
    const parsed = policyVersionSaveSchema.safeParse({ ...(editingId ? { id: editingId } : {}), key, title, body: { en: body } });
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Review the policy text."); return; }
    startTransition(async () => {
      const result = await savePolicyDraftAction(parsed.data);
      setMessage(result.ok ? "Policy saved as a draft." : result.error.message);
      if (result.ok) { setEditingId(result.data.id); window.location.reload(); }
    });
  }

  function publish(id: string) {
    startTransition(async () => {
      const result = await publishPolicyVersionAction({ id });
      setMessage(result.ok ? "Policy published." : result.error.message);
      if (result.ok) window.location.reload();
    });
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
    <section className="space-y-4">
      <h2 className="font-heading text-xl text-forest-900">Current policies</h2>
      {rows.map((row) => <article key={row.id} className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-start gap-3"><div className="mr-auto"><h3 className="font-semibold">{policyName(row.key)}</h3><p className="text-sm text-muted-foreground">{row.title} · {row.status}</p></div>{row.status === "DRAFT" ? <><Button type="button" variant="outline" onClick={() => beginEdit(row)}>Edit policy</Button><Button type="button" disabled={pending} onClick={() => publish(row.id)}>Publish</Button></> : <Button type="button" variant="outline" onClick={() => beginEdit(row)}>Edit policy</Button>}</div>
        {pendingDecision(row.meta) ? <p className="rounded-lg border border-amber-600/30 bg-amber-50 p-3 text-sm text-amber-950">Pending client decision: {pendingDecision(row.meta)}. This policy cannot be published.</p> : null}
        {row.publishedAt ? <p className="text-xs text-muted-foreground">Published {row.publishedAt.toLocaleDateString("en-IN")}.</p> : <p className="text-xs text-muted-foreground">Draft policy · not currently published.</p>}
      </article>)}
      {!rows.length ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No policies yet. Create the first policy for each type.</p> : null}
    </section>
    <section className="h-fit space-y-4 rounded-2xl border border-border/70 bg-card p-5">
      <div><h2 className="font-heading text-xl text-forest-900">{editingId ? "Edit policy" : "Create policy"}</h2><p className="mt-1 text-sm text-muted-foreground">Each policy type has one current record. Editing replaces its content; no history is kept.</p></div>
      <label className="grid gap-2 text-sm"><span className="font-medium">Policy type</span><select className="h-10 rounded-md border bg-background px-3" value={key} disabled={Boolean(editingId)} onChange={(event) => setKey(event.target.value as PolicyKey)}>{POLICY_KEYS.map((candidate) => <option key={candidate} value={candidate}>{policyName(candidate)}</option>)}</select></label>
      <label className="grid gap-2 text-sm"><span className="font-medium">Title</span><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160}/></label>
      <div className="grid gap-2 text-sm"><span className="font-medium">Policy text (English)</span><RichTextEditor label="Policy text (English)" value={body} onChange={setBody}/></div>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save policy"}</Button><Button type="button" variant="outline" onClick={() => { setEditingId(""); setTitle(""); setBody(""); setMessage(""); }}>Clear form</Button></div>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  </div>;
}
