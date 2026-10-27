"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { LocalImageUploader } from "@/components/media/LocalImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CmsContentType } from "@/config/cms-content";
import { GALLERY_CATEGORIES } from "@/config/gallery";
import { cmsContentFormSchema, type CmsContentFormData, type CmsContentFormInput } from "@/lib/schemas/cms/content";
import { createCmsPreviewAction, deleteCmsContentAction, publishCmsContentAction, reorderActivityAction, reorderGalleryItemAction, restoreCmsContentAction, saveCmsContentAction } from "@/server/actions/cms-content";

type Props = { entityType: CmsContentType; id?: string; item?: Record<string, unknown> | null; options?: { id: string; label: string }[]; media?: { id: string; publicId: string; kind: "IMAGE" | "VIDEO"; altText: unknown; format: string | null; tags?: string[] }[]; cloudName?: string; editorPath: string; listPath: string };
const localized = (value: unknown) => value && typeof value === "object" ? (value as Record<string, string>) : { en: "" };

export function CmsContentEditor({ entityType, id, item, options = [], media = [], cloudName = "", editorPath, listPath }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishAt, setPublishAt] = useState(item?.publishAt instanceof Date ? item.publishAt.toISOString().slice(0, 16) : "");
  const title = localized(item?.title ?? item?.name ?? item?.question ?? item?.quote);
  const form = useForm<CmsContentFormInput, undefined, CmsContentFormData>({
    resolver: zodResolver(cmsContentFormSchema),
    defaultValues: {
      entityType, ...(id ? { id } : {}), slug: String(item?.slug ?? ""),
      title: { en: title.en ?? "", mr: title.mr ?? "", hi: title.hi ?? "" }, name: { en: title.en ?? "", mr: title.mr ?? "", hi: title.hi ?? "" }, question: { en: title.en ?? "", mr: title.mr ?? "", hi: "" }, quote: { en: title.en ?? "", mr: title.mr ?? "", hi: "" },
      summary: localized(item?.summary ?? item?.excerpt), description: localized(item?.description), body: localized(item?.body), answer: localized(item?.answer), heroMediaId: String(item?.heroMediaId ?? ""),
      groupKey: String(item?.groupKey ?? ""), isExtraCost: Boolean(item?.isExtraCost), needsPriorNotice: Boolean(item?.needsPriorNotice), categoryId: String(item?.categoryId ?? ""),
      authorName: String(item?.authorName ?? ""), authorMeta: String(item?.authorMeta ?? ""), consentConfirmed: Boolean(item?.consentConfirmed), mediaId: String(item?.mediaId ?? ""), category: (item?.category as typeof GALLERY_CATEGORIES[number] | undefined), caption: localized(item?.caption), isFeatured: Boolean(item?.isFeatured), coverMediaId: String(item?.coverMediaId ?? ""),
    },
  });
  const { register, handleSubmit, formState: { errors } } = form;
  async function save(values: CmsContentFormData) {
    setBusy(true); setMessage("");
    const result = await saveCmsContentAction(values);
    setBusy(false);
    if (!result.ok) { setMessage(result.error.message); return; }
    router.push(`${editorPath}/${result.data.id}`); router.refresh();
  }
  async function status(statusValue: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED") {
    if (!id) { setMessage("Save this draft before changing its publishing status."); return; }
    setBusy(true);
    const result = await publishCmsContentAction({ entityType, id, status: statusValue, publishAt: statusValue === "SCHEDULED" && publishAt ? new Date(publishAt).toISOString() : null });
    setBusy(false); setMessage(result.ok ? `Status changed to ${statusValue.toLowerCase()}.` : result.error.message); router.refresh();
  }
  const titleField = entityType === "activity" || entityType === "menu-category" || entityType === "menu-item" ? "name" : entityType === "faq" ? "question" : "title";
  const titleInput = titleField === "name" ? register("name.en") : titleField === "question" ? register("question.en") : register("title.en");
  const titleMrInput = titleField === "name" ? register("name.mr") : titleField === "question" ? register("question.mr") : register("title.mr");
  const titleHiInput = titleField === "name" ? register("name.hi") : titleField === "question" ? register("question.hi") : register("title.hi");
  const titleError = titleField === "name" ? errors.name?.en?.message : titleField === "question" ? errors.question?.en?.message : errors.title?.en?.message;
  const body = useWatch({ control: form.control, name: "body.en" }) ?? "";
  const bodyMr = useWatch({ control: form.control, name: "body.mr" }) ?? "";
  const bodyHi = useWatch({ control: form.control, name: "body.hi" }) ?? "";
  const answer = useWatch({ control: form.control, name: "answer.en" }) ?? "";
  const answerMr = useWatch({ control: form.control, name: "answer.mr" }) ?? "";
  const answerHi = useWatch({ control: form.control, name: "answer.hi" }) ?? "";
  const heroMediaId = useWatch({ control: form.control, name: "heroMediaId" }) ?? "";
  const galleryMediaId = useWatch({ control: form.control, name: "mediaId" }) ?? "";
  const activityName = useWatch({ control: form.control, name: "name.en" }) ?? "";
  useEffect(() => {
    if (entityType !== "activity" || form.getValues("slug") || !activityName.trim()) return;
    form.setValue("slug", activityName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), { shouldDirty: true });
  }, [activityName, entityType, form]);
  const coverMediaId = useWatch({ control: form.control, name: "coverMediaId" }) ?? "";
  return <form className="space-y-6" onSubmit={handleSubmit(save)}>
    <div className="grid gap-4 rounded-xl border p-5 md:grid-cols-2">
      {!['menu-item', 'faq', 'gallery-item'].includes(entityType) ? <Field label="Slug" error={errors.slug?.message}><Input {...register("slug")} /></Field> : null}
      {!['gallery-item'].includes(entityType) ? <Field label={titleField === 'question' ? 'Question (English)' : 'Name / title (English)'} error={titleError}><Input {...titleInput} /></Field> : null}
      {entityType !== 'gallery-item' && entityType !== 'post-category' ? <><Field label="Name / title (Marathi)"><Input {...titleMrInput} /></Field><Field label="Name / title (Hindi)"><Input {...titleHiInput} /></Field></> : null}
      {entityType === 'activity' || entityType === 'menu-item' ? <><Field label="Description (English)"><textarea className="min-h-24 w-full rounded-md border bg-background p-3" {...register("description.en")} /></Field><Field label="Description (Marathi)"><textarea className="min-h-24 w-full rounded-md border bg-background p-3" {...register("description.mr")} /></Field><Field label="Description (Hindi)"><textarea className="min-h-24 w-full rounded-md border bg-background p-3" {...register("description.hi")} /></Field></> : null}
      {entityType === 'activity' ? <><div className="flex flex-wrap gap-5 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" {...register("isExtraCost")} /> Extra cost</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" {...register("needsPriorNotice")} /> Prior notice required</label></div><Field label="Conditions note (English)"><Input {...register("conditionsNote.en")} /></Field><Field label="Price note (English)"><Input {...register("priceNote.en")} /></Field></> : null}
      {entityType === 'experience' || entityType === 'post' ? <><Field label="Body (English)"><RichTextEditor label="Body (English)" value={body} onChange={(value) => form.setValue("body.en", value, { shouldDirty: true })} /></Field><Field label="Body (Marathi)"><RichTextEditor label="Body (Marathi)" value={bodyMr} onChange={(value) => form.setValue("body.mr", value, { shouldDirty: true })} /></Field><Field label="Body (Hindi)"><RichTextEditor label="Body (Hindi)" value={bodyHi} onChange={(value) => form.setValue("body.hi", value, { shouldDirty: true })} /></Field></> : null}
      {entityType === 'faq' ? <><Field label="Answer (English)"><RichTextEditor label="Answer (English)" value={answer} onChange={(value) => form.setValue("answer.en", value, { shouldDirty: true })} /></Field><Field label="Answer (Marathi)"><RichTextEditor label="Answer (Marathi)" value={answerMr} onChange={(value) => form.setValue("answer.mr", value, { shouldDirty: true })} /></Field><Field label="Answer (Hindi)"><RichTextEditor label="Answer (Hindi)" value={answerHi} onChange={(value) => form.setValue("answer.hi", value, { shouldDirty: true })} /></Field><Field label="FAQ group"><Input {...register("groupKey")} /></Field></> : null}
      {entityType === 'activity' || entityType === 'experience' ? <LocalImageUploader label="Hero image" value={heroMediaId} media={media.find((item) => item.id === heroMediaId && item.kind === "IMAGE")} cloudName={cloudName} onChange={(value) => form.setValue("heroMediaId", value, { shouldDirty: true })} onRemove={() => form.setValue("heroMediaId", "", { shouldDirty: true })} disabled={busy} /> : null}
      {entityType === 'menu-item' ? <><Field label="Category" error={errors.categoryId?.message}><select className="h-10 rounded-md border bg-background px-3" {...register("categoryId")}><option value="">Choose a category</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field><Field label="Diet"><select className="h-10 rounded-md border bg-background px-3" {...register("foodPreference")}><option value="">Not specified</option><option value="VEG">Vegetarian</option><option value="NON_VEG">Non-vegetarian</option></select></Field></> : null}
      {entityType === 'post' ? <><Field label="Excerpt (English)"><Input {...register("summary.en")} /></Field><Field label="Author"><Input {...register("authorName")} /></Field><LocalImageUploader label="Cover image" value={coverMediaId} media={media.find((asset) => asset.id === coverMediaId && asset.kind === "IMAGE")} cloudName={cloudName} onChange={(asset) => form.setValue("coverMediaId", asset, { shouldDirty: true })} onRemove={() => form.setValue("coverMediaId", "", { shouldDirty: true })} disabled={busy} /></> : null}
      {entityType === 'gallery-item' ? <><LocalImageUploader label="Gallery image" value={galleryMediaId} media={media.find((item) => item.id === galleryMediaId && item.kind === "IMAGE")} cloudName={cloudName} onChange={(value) => form.setValue("mediaId", value, { shouldDirty: true })} onRemove={() => form.setValue("mediaId", "", { shouldDirty: true })} disabled={busy} /><Field label="Category"><select className="h-10 rounded-md border bg-background px-3" {...register("category")}>{GALLERY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Caption (English)"><Input {...register("caption.en")} /></Field><Field label="Featured"><input type="checkbox" {...register("isFeatured")} /></Field></> : null}
      {Object.entries(errors).map(([key, value]) => value?.message ? <p key={key} className="text-sm text-destructive">{String(value.message)}</p> : null)}
    </div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border p-4"><span className="mr-auto text-sm text-muted-foreground">Current status: {String(item?.status ?? "DRAFT")}</span><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>{entityType !== "post-category" ? <><Button type="button" variant="outline" disabled={busy} onClick={() => void status("PUBLISHED")}>Publish</Button><Input aria-label="Scheduled publish time" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} className="w-auto"/><Button type="button" variant="outline" disabled={busy || !publishAt} onClick={() => void status("SCHEDULED")}>Schedule</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void status("DRAFT")}>Set draft</Button>{id ? <Button type="button" variant="outline" onClick={async () => { const result = await createCmsPreviewAction({ entityType, id }); setMessage(result.ok ? `Preview: ${result.data.url}` : result.error.message); }}>Preview</Button> : null}</> : null}{id && entityType === "gallery-item" ? <><Button type="button" variant="outline" onClick={async () => { const result = await reorderGalleryItemAction({ id, direction: "up" }); setMessage(result.ok ? "Moved up." : result.error.message); }}>Move up</Button><Button type="button" variant="outline" onClick={async () => { const result = await reorderGalleryItemAction({ id, direction: "down" }); setMessage(result.ok ? "Moved down." : result.error.message); }}>Move down</Button></> : null}{id && entityType === "activity" ? <><Button type="button" variant="outline" onClick={async () => { const result = await reorderActivityAction({ id, direction: "up" }); setMessage(result.ok ? "Moved up." : result.error.message); }}>Move up</Button><Button type="button" variant="outline" onClick={async () => { const result = await reorderActivityAction({ id, direction: "down" }); setMessage(result.ok ? "Moved down." : result.error.message); }}>Move down</Button></> : null}{id && item?.deletedAt ? <Button type="button" variant="outline" onClick={async () => { const result = await restoreCmsContentAction({ entityType, id }); setMessage(result.ok ? "Restored." : result.error.message); router.refresh(); }}>Restore</Button> : id ? <Button type="button" variant="destructive" onClick={async () => { const result = await deleteCmsContentAction({ entityType, id }); setMessage(result.ok ? "Moved to trash." : result.error.message); if (result.ok) router.push(listPath); }}>Move to trash</Button> : null}<Button asChild variant="ghost"><Link href={listPath}>Back to list</Link></Button></div>
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
  </form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span>{children}{error ? <span className="text-destructive">{error}</span> : null}</label>; }
