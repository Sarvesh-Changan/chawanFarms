"use client";

import { useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SeoEntityType } from "@/lib/schemas/cms/seo";
import { seoMetadataSchema } from "@/lib/schemas/cms/seo";
import { saveSeoMetadataAction } from "@/server/actions/cms-seo";

type SeoImage = { id: string; publicId: string; altText: unknown; format: string | null; kind?: "IMAGE" };
type InitialSeo = { title?: string | null; description?: string | null; keywords?: string | null; canonicalUrl?: string | null; robots?: string | null; ogMediaId?: string | null; jsonLd?: unknown };

export function SeoMetadataPanel({ entityType, entityId, initial, images, cloudName }: { entityType: SeoEntityType; entityId: string; initial?: InitialSeo | null; images: SeoImage[]; cloudName: string }) {
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [jsonLdText, setJsonLdText] = useState(initial?.jsonLd ? JSON.stringify(initial.jsonLd, null, 2) : "");
  const [ogMediaId, setOgMediaId] = useState(initial?.ogMediaId ?? "");
  const [values, setValues] = useState({ title: initial?.title ?? "", description: initial?.description ?? "", keywords: initial?.keywords ?? "", canonicalUrl: initial?.canonicalUrl ?? "", robots: initial?.robots ?? "" });
  function update(name: keyof typeof values, value: string) { setValues((current) => ({ ...current, [name]: value })); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    let jsonLd: unknown = null;
    try { jsonLd = jsonLdText.trim() ? JSON.parse(jsonLdText) as unknown : null; }
    catch { setErrors({ jsonLd: "Enter valid JSON." }); setBusy(false); return; }
    const parsed = seoMetadataSchema.safeParse({ entityType, entityId, locale: "en", ...values, ogMediaId, jsonLd });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])));
      setBusy(false); return;
    }
    const result = await saveSeoMetadataAction(parsed.data);
    setBusy(false);
    setMessage(result.ok ? "SEO metadata saved." : result.error.message);
    if (!result.ok && result.error.fieldErrors) setErrors(Object.fromEntries(Object.entries(result.error.fieldErrors).map(([key, messages]) => [key, messages[0] ?? "Invalid value."])));
  }
  return <section className="rounded-2xl border border-border/70 bg-card p-5">
    <div className="mb-4"><h2 className="font-heading text-xl text-forest-900">SEO metadata</h2><p className="mt-1 text-sm text-muted-foreground">English metadata, canonical URL, robots, Open Graph image, and optional JSON-LD.</p></div>
    <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void save(event)}>
      <Field label="Title" error={errors.title}><Input maxLength={70} value={values.title} onChange={(event) => update("title", event.target.value)} /></Field>
      <Field label="Keywords (comma-separated)" error={errors.keywords}><Input maxLength={500} value={values.keywords} onChange={(event) => update("keywords", event.target.value)} /></Field>
      <Field label="Description" error={errors.description}><Textarea maxLength={160} value={values.description} onChange={(event) => update("description", event.target.value)} /></Field>
      <Field label="Canonical HTTPS URL" error={errors.canonicalUrl}><Input type="url" value={values.canonicalUrl} onChange={(event) => update("canonicalUrl", event.target.value)} /></Field>
      <Field label="Robots" error={errors.robots}><select className="h-10 rounded-md border bg-background px-3" value={values.robots} onChange={(event) => update("robots", event.target.value)}><option value="">Use site default</option><option>index,follow</option><option>noindex,follow</option><option>index,nofollow</option><option>noindex,nofollow</option></select></Field>
      <Field label="Open Graph image" error={errors.ogMediaId}><div className="flex items-center gap-2"><Input value={ogMediaId} readOnly aria-label="Selected Open Graph image ID"/><MediaPicker cloudName={cloudName} items={images.map((image) => ({ ...image, kind: "IMAGE" as const }))} onSelect={(image) => setOgMediaId(image.id)}><Button type="button" variant="outline">Choose</Button></MediaPicker><Button type="button" variant="ghost" onClick={() => setOgMediaId("")}>Clear</Button></div></Field>
      <Field label="JSON-LD override" error={errors.jsonLd}><Textarea className="min-h-40 font-mono text-xs" value={jsonLdText} onChange={(event) => setJsonLdText(event.target.value)} placeholder="{ &quot;@context&quot;: &quot;https://schema.org&quot;, ... }" /></Field>
      <div className="flex items-end"><Button disabled={busy}>{busy ? "Saving…" : "Save SEO metadata"}</Button></div>
    </form>
    {message ? <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
  </section>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span>{children}{error ? <span className="text-destructive">{error}</span> : null}</label>; }
