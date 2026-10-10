"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SeoMetadataPanel } from "@/components/admin/cms/SeoMetadataPanel";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SECTION_TYPES, type PageSectionType } from "@/config/page-builder";
import { pageSectionDefaults } from "@/lib/cms-page-policy";
import { pageBuilderSchema } from "@/lib/schemas/cms/pages";
import type { SeoEntityType } from "@/lib/schemas/cms/seo";
import { createPagePreviewAction, savePageBuilderAction, setPageStatusAction } from "@/server/actions/cms-pages";

type SectionDraft = { type: PageSectionType; content: Record<string, unknown>; isVisible: boolean };
type ImageOption = { id: string; publicId: string; altText: unknown; format: string | null; kind?: "IMAGE" };
type StoredSection = { type: string; content: unknown; isVisible: boolean };
type PageData = { id: string; slug: string; title: unknown; status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"; sections: StoredSection[] };
const locales = ["en", "mr", "hi"] as const;
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function localizedValue(value: unknown): Record<string, string> {
  const record = objectValue(value);
  return {
    en: typeof record.en === "string" ? record.en : "",
    mr: typeof record.mr === "string" ? record.mr : "",
    hi: typeof record.hi === "string" ? record.hi : "",
  };
}
function localeValue(value: Record<string, string>, locale: (typeof locales)[number]): string {
  switch (locale) { case "en": return value.en ?? ""; case "mr": return value.mr ?? ""; case "hi": return value.hi ?? ""; }
}
function localizedUpdate(value: Record<string, string>, locale: (typeof locales)[number], text: string) {
  switch (locale) {
    case "en": return { ...value, en: text };
    case "mr": return { ...value, mr: text };
    case "hi": return { ...value, hi: text };
  }
}
function sectionName(type: PageSectionType): string {
  switch (type) {
    case "hero": return "Hero"; case "why-chawan": return "Why Chawan"; case "experiences-grid": return "Experiences grid";
    case "accommodation": return "Accommodation"; case "packages": return "Packages"; case "food": return "Food";
    case "activities": return "Activities"; case "gallery": return "Gallery"; case "stories": return "Stories";
    case "rewards-teaser": return "Rewards teaser"; case "location": return "Location"; case "final-cta": return "Final CTA";
    case "rich-text": return "Rich text"; case "image-text": return "Image + text";
  }
}
function updateSectionField(section: SectionDraft, field: string, value: unknown): SectionDraft {
  switch (field) {
    case "heading": return { ...section, content: { ...section.content, heading: value } };
    case "body": return { ...section, content: { ...section.content, body: value } };
    case "eyebrow": return { ...section, content: { ...section.content, eyebrow: value } };
    case "ctaLabel": return { ...section, content: { ...section.content, ctaLabel: value } };
    case "ctaHref": return { ...section, content: { ...section.content, ctaHref: value } };
    case "imageMediaId": return { ...section, content: { ...section.content, imageMediaId: value } };
    case "imageSide": return { ...section, content: { ...section.content, imageSide: value } };
    case "items": return { ...section, content: { ...section.content, items: value } };
    default: return section;
  }
}
function moveSectionAt(sections: SectionDraft[], index: number, delta: -1 | 1): SectionDraft[] {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= sections.length) return sections;
  const copy = [...sections];
  const moving = copy.splice(index, 1)[0];
  if (!moving) return sections;
  copy.splice(target, 0, moving);
  return copy;
}

export function PageBuilder({ page, images, cloudName, seo, seoImages, canEditSeo }: { page: PageData; images: ImageOption[]; cloudName: string; seo: { title?: string | null; description?: string | null; keywords?: string | null; canonicalUrl?: string | null; robots?: string | null; ogMediaId?: string | null; jsonLd?: unknown } | null; seoImages: ImageOption[]; canEditSeo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [itemsJsonError, setItemsJsonError] = useState("");
  const [title, setTitle] = useState(localizedValue(page.title));
  const [sections, setSections] = useState<SectionDraft[]>(() => page.sections.flatMap((section) => {
    if (!PAGE_SECTION_TYPES.includes(section.type as PageSectionType)) return [];
    return [{ type: section.type as PageSectionType, content: objectValue(section.content), isVisible: section.isVisible }];
  }));
  const [newType, setNewType] = useState<PageSectionType>("hero");
  const status = page.status;
  const mediaItems = useMemo(() => images.map((image) => ({ ...image, kind: "IMAGE" as const })), [images]);

  function updateSection(index: number, update: (section: SectionDraft) => SectionDraft) {
    setSections((current) => current.map((section, at) => at === index ? update(section) : section));
  }
  function addSection() {
    const parsed = pageBuilderSchema.shape.sections.element.safeParse({ type: newType, content: pageSectionDefaults(newType), isVisible: newType !== "rewards-teaser" });
    if (!parsed.success) { setMessage("Section defaults failed validation."); return; }
    setSections((current) => [...current, parsed.data as SectionDraft]);
  }
  function submit(action: "save" | "publish" | "draft") {
    startTransition(async () => {
      setMessage(""); setValidationMessages([]);
      if (itemsJsonError) { setMessage("Correct the section items JSON before saving."); return; }
      const parsed = pageBuilderSchema.safeParse({ id: page.id, title, sections });
      if (!parsed.success) {
        setValidationMessages(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
        setMessage("Review the highlighted section fields before saving."); return;
      }
      if (action === "save") {
        const result = await savePageBuilderAction(parsed.data);
        setMessage(result.ok ? "Page draft saved." : result.error.message);
      } else {
        const saved = await savePageBuilderAction(parsed.data);
        if (!saved.ok) { setMessage(saved.error.message); return; }
        const result = await setPageStatusAction({ id: page.id, status: action === "publish" ? "PUBLISHED" : "DRAFT" });
        setMessage(result.ok ? action === "publish" ? "Page published." : "Page returned to draft." : result.error.message);
      }
      router.refresh();
    });
  }
  async function preview() {
    const result = await createPagePreviewAction({ id: page.id });
    if (!result.ok) { setMessage(result.error.message); return; }
    setPreviewUrl(result.data.url);
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  return <div className="space-y-6">
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><h2 className="font-heading text-2xl text-forest-900">/{page.slug === "home" ? "" : page.slug}</h2><p className="text-sm text-muted-foreground">Status: {status}</p></div><Button type="button" variant="outline" disabled={pending} onClick={() => void preview()}>Preview</Button><Button type="button" variant="outline" disabled={pending} onClick={() => submit("save")}>Save draft</Button><Button type="button" disabled={pending} onClick={() => submit("publish")}>Publish</Button>{status === "PUBLISHED" ? <Button type="button" variant="outline" disabled={pending} onClick={() => submit("draft")}>Unpublish</Button> : null}</div>
      {previewUrl ? <p className="text-sm"><a className="underline" href={previewUrl} target="_blank" rel="noreferrer">Open signed preview</a></p> : null}
      <LocalizedFields label="Page title" value={title} onChange={setTitle} />
      <div className="flex flex-wrap gap-2"><select className="h-10 min-w-52 rounded-md border bg-background px-3" value={newType} onChange={(event) => setNewType(event.target.value as PageSectionType)}>{PAGE_SECTION_TYPES.map((type) => <option key={type} value={type}>{sectionName(type)}</option>)}</select><Button type="button" variant="outline" onClick={addSection}>Add section</Button></div>
    </section>
    <div className="space-y-4">{sections.map((section, index) => <section key={`${section.type}-${index}`} className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2"><h3 className="mr-auto font-heading text-xl text-forest-900">{index + 1}. {sectionName(section.type)}</h3><label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={section.isVisible} onChange={(event) => updateSection(index, (current) => ({ ...current, isVisible: event.target.checked }))}/>Visible</label><Button type="button" variant="outline" disabled={index === 0} onClick={() => setSections((current) => moveSectionAt(current, index, -1))}>Move up</Button><Button type="button" variant="outline" disabled={index === sections.length - 1} onClick={() => setSections((current) => moveSectionAt(current, index, 1))}>Move down</Button><Button type="button" variant="destructive" onClick={() => setSections((current) => current.filter((_, at) => at !== index))}>Remove</Button></div>
      <div className="grid gap-4 md:grid-cols-2">{Object.entries(section.content).map(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const localized = objectValue(value);
          if (locales.some((locale) => locale in localized)) return <div key={key} className="grid gap-3 rounded-lg bg-muted/40 p-3 md:col-span-2"><p className="text-sm font-medium capitalize">{key.replaceAll(/([A-Z])/g, " $1")}</p><LocalizedFields label={key} value={localizedValue(value)} onChange={(next) => updateSection(index, (current) => updateSectionField(current, key, next))} rich={key === "body" && (section.type === "rich-text" || section.type === "image-text")} /></div>;
        }
        if (key === "imageMediaId") return <Field key={key} label="Image"><div className="flex items-center gap-2"><Input readOnly value={typeof value === "string" ? value : ""} aria-label="Selected image ID"/><MediaPicker cloudName={cloudName} items={mediaItems} onSelect={(asset) => updateSection(index, (current) => updateSectionField(current, "imageMediaId", asset.id))}><Button type="button" variant="outline">Choose image</Button></MediaPicker>{value ? <Button type="button" variant="ghost" onClick={() => updateSection(index, (current) => updateSectionField(current, "imageMediaId", null))}>Clear</Button> : null}</div></Field>;
        if (key === "items" && Array.isArray(value)) return <Field key={key} label="Items (JSON)" error={itemsJsonError}><textarea className="min-h-32 w-full rounded-md border bg-background p-3 font-mono text-xs" value={JSON.stringify(value, null, 2)} onChange={(event) => { try { const items: unknown = JSON.parse(event.target.value); if (Array.isArray(items)) { updateSection(index, (current) => updateSectionField(current, "items", items)); setItemsJsonError(""); } else setItemsJsonError("Enter a JSON array."); } catch { setItemsJsonError("Keep this field valid JSON."); } }}/></Field>;
        return <Field key={key} label={key.replaceAll(/([A-Z])/g, " $1")}>{key === "imageSide" ? <select className="h-10 rounded-md border bg-background px-3" value={String(value)} onChange={(event) => updateSection(index, (current) => updateSectionField(current, "imageSide", event.target.value))}><option value="left">Left</option><option value="right">Right</option></select> : key === "ctaHref" ? <Input value={String(value ?? "")} placeholder="/contact" onChange={(event) => updateSection(index, (current) => updateSectionField(current, "ctaHref", event.target.value))}/> : <textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={String(value ?? "")} onChange={(event) => updateSection(index, (current) => updateSectionField(current, key, event.target.value))}/>}</Field>;
      })}</div>
    </section>)}</div>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => submit("save")}>Save page</Button><Button type="button" disabled={pending} onClick={() => submit("publish")}>Save and publish</Button></div>
    {validationMessages.length ? <ul className="list-disc pl-5 text-sm text-destructive">{validationMessages.map((error) => <li key={error}>{error}</li>)}</ul> : null}
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    {canEditSeo ? <SeoMetadataPanel entityType={"page" satisfies SeoEntityType} entityId={page.id} initial={seo} images={seoImages} cloudName={cloudName}/> : null}
  </div>;
}

function LocalizedFields({ label, value, onChange, rich = false }: { label: string; value: Record<string, string>; onChange: (value: Record<string, string>) => void; rich?: boolean }) {
  return <div className="grid gap-3 md:grid-cols-3">{locales.map((locale) => <label key={`${label}-${locale}`} className="grid gap-2 text-sm"><span className="font-medium">{label} ({locale}){locale === "en" ? " *" : ""}</span>{rich ? <RichTextEditor label={`${label} (${locale})`} value={localeValue(value, locale)} onChange={(text) => onChange(localizedUpdate(value, locale, text))}/> : <textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={localeValue(value, locale)} onChange={(event) => onChange(localizedUpdate(value, locale, event.target.value))}/>}</label>)}</div>;
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span>{children}{error ? <span className="text-destructive">{error}</span> : null}</label>; }
