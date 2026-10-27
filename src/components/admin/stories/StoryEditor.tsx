"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { LocalImageUploader, type LocalUploaderMedia } from "@/components/media/LocalImageUploader";
import { LocalVideoUploader } from "@/components/media/LocalVideoUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storyFormSchema, type StoryFormData } from "@/lib/schemas/cms/stories";
import { createCmsPreviewAction } from "@/server/actions/cms-content";
import { deleteStoryAction, restoreStoryAction, saveStoryAction, setStoryStatusAction } from "@/server/actions/cms-stories";

type StoryMedia = LocalUploaderMedia & { kind: "IMAGE" | "VIDEO"; caption?: unknown };
type StoryInitial = { id?: string; kind?: StoryFormData["kind"]; title?: unknown; summary?: unknown; body?: unknown; coverMediaId?: string | null; photoMediaIds?: unknown; videoMediaId?: string | null; slug?: string; featured?: boolean; status?: string; publishAt?: Date | string | null; deletedAt?: Date | string | null; media: StoryMedia[] };

function localized(value: unknown): Record<string, string> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string> : { en: "" }; }
function mediaCaption(value: unknown): string { const record = localized(value); return record.en ?? ""; }
function dateInput(value: Date | string | null | undefined): string { if (!value) return ""; return new Date(value).toISOString().slice(0, 16); }

export function StoryEditor({ initial, cloudName, listPath = "/admin/stories" }: { initial: StoryInitial | null; cloudName: string; listPath?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [publishAt, setPublishAt] = useState(dateInput(initial?.publishAt));
  const [busy, startTransition] = useTransition();
  const form = useForm<z.input<typeof storyFormSchema>, undefined, StoryFormData>({ resolver: zodResolver(storyFormSchema), defaultValues: { id: initial?.id, kind: initial?.kind ?? "STORY", title: localized(initial?.title), summary: localized(initial?.summary), body: localized(initial?.body), coverMediaId: initial?.coverMediaId ?? "", photoMediaIds: Array.isArray(initial?.photoMediaIds) ? initial?.photoMediaIds.filter((value): value is string => typeof value === "string") : [], videoMediaId: initial?.videoMediaId ?? "", slug: initial?.slug ?? "", featured: initial?.featured ?? false } });
  const title = useWatch({ control: form.control, name: "title.en" }) ?? "";
  const coverMediaId = useWatch({ control: form.control, name: "coverMediaId" }) ?? "";
  const videoMediaId = useWatch({ control: form.control, name: "videoMediaId" }) ?? "";
  const photoMediaIds = (useWatch({ control: form.control, name: "photoMediaIds" }) ?? []) as string[];
  const getMedia = (id: string | undefined) => initial?.media.find((media) => media.id === id);

  function save(values: StoryFormData) {
    startTransition(async () => { setMessage(""); const result = await saveStoryAction(values); if (!result.ok) { setMessage(result.error.message); return; } setMessage("Draft saved."); router.push(`/admin/stories/${result.data.id}`); router.refresh(); });
  }
  function status(value: "DRAFT" | "SCHEDULED" | "PUBLISHED") {
    if (!initial?.id) { setMessage("Save the story before changing its status."); return; }
    startTransition(async () => { const result = await setStoryStatusAction({ id: initial.id, status: value, publishAt: value === "SCHEDULED" && publishAt ? new Date(publishAt).toISOString() : null }); setMessage(result.ok ? `Story set to ${value.toLowerCase()}.` : result.error.message); router.refresh(); });
  }
  function changePhoto(index: number, id: string) { const next = [...photoMediaIds]; if (index >= next.length) next.push(id); else next.splice(index, 1, id); form.setValue("photoMediaIds", next, { shouldDirty: true }); }
  function removePhoto(index: number) { form.setValue("photoMediaIds", photoMediaIds.filter((_, itemIndex) => itemIndex !== index), { shouldDirty: true }); }
  const photoSlots = photoMediaIds.length < 8 ? [...photoMediaIds, ""] : photoMediaIds;

  return <form className="space-y-6" onSubmit={form.handleSubmit(save)}>
    <div className="grid gap-4 rounded-xl border border-border/70 p-5 md:grid-cols-2">
      <Field label="Title (English)" error={form.formState.errors.title?.en?.message}><Input {...form.register("title.en")} /></Field>
      <Field label="Title (Marathi)"><Input {...form.register("title.mr")} /></Field>
      <Field label="Title (Hindi)"><Input {...form.register("title.hi")} /></Field>
      <Field label="Kind"><select className="min-h-10 rounded-md border bg-background px-3" {...form.register("kind")} disabled={initial?.kind === "GUEST"}><option value="STORY">Story</option><option value="EXPERIENCE">Farm experience</option><option value="GUEST">Guest story</option></select></Field>
      <Field label="Slug" error={form.formState.errors.slug?.message}><Input {...form.register("slug")} placeholder="story-slug" /></Field>
      <Field label="Short description (English)"><Input {...form.register("summary.en")} /></Field>
      <div className="md:col-span-2"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" {...form.register("featured")} /> Feature in the Stories order</label><p className="mt-1 text-xs text-muted-foreground">New entries remain drafts until explicitly published.</p></div>
      <div className="md:col-span-2"><label className="grid gap-2 text-sm"><span className="font-medium">Body (optional)</span><RichTextEditor label="Story body" value={String(localized(form.getValues("body")).en ?? "")} onChange={(value) => form.setValue("body", { en: value }, { shouldDirty: true })}/></label></div>
    </div>
    <LocalImageUploader label="Cover image" value={coverMediaId} media={getMedia(coverMediaId)} cloudName={cloudName} onChange={(id) => form.setValue("coverMediaId", id, { shouldDirty: true })} onRemove={() => form.setValue("coverMediaId", "", { shouldDirty: true })} helperText="Use an approved local image with accurate English alt text." disabled={busy}/>
    <section className="space-y-3 rounded-xl border border-border/70 p-5" aria-labelledby="story-photos-heading"><div><h2 id="story-photos-heading" className="font-heading text-xl">Photos (optional, up to 8)</h2><p className="text-sm text-muted-foreground">Each photo needs its own English alt text.</p></div><div className="grid gap-4 md:grid-cols-2">{photoSlots.map((id, index) => <LocalImageUploader key={`${index}-${id}`} label={`Photo ${index + 1}`} value={id} media={getMedia(id)} cloudName={cloudName} onChange={(mediaId) => changePhoto(index, mediaId)} onRemove={() => removePhoto(index)} disabled={busy}/>)}</div></section>
    <LocalVideoUploader label="Story video (optional)" value={videoMediaId} publicId={getMedia(videoMediaId)?.publicId} cloudName={cloudName} description={mediaCaption(getMedia(videoMediaId)?.caption)} onChange={(id) => form.setValue("videoMediaId", id, { shouldDirty: true })} onRemove={() => form.setValue("videoMediaId", "", { shouldDirty: true })} disabled={busy}/>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 p-4"><span className="mr-auto text-sm text-muted-foreground">Current status: {initial?.status ?? "DRAFT"}</span><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>{initial?.id ? <><Button type="button" variant="outline" disabled={busy} onClick={() => status("PUBLISHED")}>Publish</Button><Input aria-label="Scheduled publish time" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} className="w-auto"/><Button type="button" variant="outline" disabled={busy || !publishAt} onClick={() => status("SCHEDULED")}>Schedule</Button><Button type="button" variant="outline" disabled={busy} onClick={() => status("DRAFT")}>Set draft</Button><Button type="button" variant="outline" disabled={busy} onClick={async () => { const result = await createCmsPreviewAction({ entityType: "post", id: initial.id }); setMessage(result.ok ? `Preview: ${result.data.url}` : result.error.message); }}>Preview</Button><Button type="button" variant="outline" disabled={busy} onClick={() => startTransition(async () => { const result = initial.deletedAt ? await restoreStoryAction({ id: initial.id }) : await deleteStoryAction({ id: initial.id }); setMessage(result.ok ? (initial.deletedAt ? "Story restored." : "Story moved to trash.") : result.error.message); router.push(listPath); router.refresh(); })}>{initial.deletedAt ? "Restore" : "Move to trash"}</Button></> : null}<Button asChild type="button" variant="ghost"><Link href={listPath}>Back to stories</Link></Button></div>
    {message ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p> : null}
    {title && !form.getValues("slug") ? <p className="text-xs text-muted-foreground">Add a slug before saving this story.</p> : null}
  </form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span>{children}{error ? <span className="text-destructive">{String(error)}</span> : null}</label>; }
