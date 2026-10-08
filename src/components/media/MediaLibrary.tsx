"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CldImage } from "@/components/media/CldImage";
import { Uploader } from "@/components/media/Uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/config/locales";
import { formatMediaBytes } from "@/config/media";
import { localizedMediaTextSchema } from "@/lib/schemas/media";
import { softDeleteMediaAction, updateMediaAction } from "@/server/actions/media";

export type MediaLibraryItem = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  origin: "ADMIN" | "CUSTOMER";
  publicId: string;
  resourceType: string;
  deliveryType: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  altText: unknown;
  caption: unknown;
  focalX: number | null;
  focalY: number | null;
  tags: string[];
  category: string | null;
  uploadedById: string | null;
  isPublic: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  usages: Array<{ id: string; entityType: string; entityId: string; field: string | null }>;
};

function localeValue(raw: unknown, locale: SupportedLocale): string {
  const parsed = localizedMediaTextSchema.safeParse(raw);
  if (!parsed.success) return "";
  switch (locale) {
    case "en": return parsed.data.en ?? "";
    case "mr": return parsed.data.mr ?? "";
    case "hi": return parsed.data.hi ?? "";
  }
}

function localizedValue(values: Record<SupportedLocale, string>, locale: SupportedLocale): string {
  switch (locale) {
    case "en": return values.en;
    case "mr": return values.mr;
    case "hi": return values.hi;
  }
}

function setLocalizedValue(values: Record<SupportedLocale, string>, locale: SupportedLocale, value: string): Record<SupportedLocale, string> {
  switch (locale) {
    case "en": return { ...values, en: value };
    case "mr": return { ...values, mr: value };
    case "hi": return { ...values, hi: value };
  }
}

function MediaDetailEditor({ item, cloudName, canDelete, onSaved, onDeleted }: {
  item: MediaLibraryItem;
  cloudName: string;
  canDelete: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(item.isPublic);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [category, setCategory] = useState(item.category ?? "");
  const [focalX, setFocalX] = useState(item.focalX === null ? "" : String(item.focalX));
  const [focalY, setFocalY] = useState(item.focalY === null ? "" : String(item.focalY));
  const [altText, setAltText] = useState<Record<SupportedLocale, string>>({
    en: localeValue(item.altText, "en"), mr: localeValue(item.altText, "mr"), hi: localeValue(item.altText, "hi"),
  });
  const [caption, setCaption] = useState<Record<SupportedLocale, string>>({
    en: localeValue(item.caption, "en"), mr: localeValue(item.caption, "mr"), hi: localeValue(item.caption, "hi"),
  });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateMediaAction({
        id: item.id,
        kind: item.kind,
        altText,
        caption,
        focalX: focalX ? Number(focalX) : null,
        focalY: focalY ? Number(focalY) : null,
        tags: [...new Set(tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
        category: category.trim() || null,
        isPublic,
      });
      setMessage(result.ok ? "Media details saved." : result.error.message);
      if (result.ok) {
        onSaved();
        router.refresh();
      }
    });
  }

  async function remove() {
    const result = await softDeleteMediaAction({ id: item.id });
    setMessage(result.ok ? "Media soft-deleted." : result.error.message);
    if (result.ok) {
      onDeleted();
      router.refresh();
    }
  }

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
    <div className="relative mx-4 aspect-video overflow-hidden rounded-lg bg-muted">
      <CldImage cloudName={cloudName} publicId={item.publicId} alt={localeValue(item.altText, "en")} resourceType={item.kind === "VIDEO" ? "video" : "image"} fill sizes="(min-width: 640px) 40vw, 90vw" className="object-contain" />
    </div>
    <div className="grid gap-1 px-4 pt-3 text-xs text-muted-foreground"><p className="break-all font-mono">{item.publicId}</p><p>{item.kind.toLowerCase()} · {item.format ?? "unknown format"}{item.bytes ? ` · ${formatMediaBytes(item.bytes)}` : ""}{item.durationSec ? ` · ${item.durationSec}s` : ""}</p></div>
    <form onSubmit={save} className="grid gap-4 p-4">
      <fieldset className="grid gap-3"><legend className="mb-2 text-sm font-semibold">Alt text by locale</legend>{SUPPORTED_LOCALES.map((locale) => <label key={locale} className="grid gap-1 text-xs font-medium uppercase">{locale}{locale === "en" && item.kind === "IMAGE" && isPublic ? " · required" : ""}<Input value={localizedValue(altText, locale)} maxLength={500} required={locale === "en" && item.kind === "IMAGE" && isPublic} onChange={(event) => setAltText((current) => setLocalizedValue(current, locale, event.target.value))} /></label>)}</fieldset>
      <fieldset className="grid gap-3"><legend className="mb-2 text-sm font-semibold">Caption by locale</legend>{SUPPORTED_LOCALES.map((locale) => <label key={locale} className="grid gap-1 text-xs font-medium uppercase">{locale}<Textarea value={localizedValue(caption, locale)} maxLength={500} onChange={(event) => setCaption((current) => setLocalizedValue(current, locale, event.target.value))} /></label>)}</fieldset>
      <label className="grid gap-1 text-xs font-medium">Category<Input value={category} maxLength={80} onChange={(event) => setCategory(event.target.value)} /></label>
      <label className="grid gap-1 text-xs font-medium">Tags (comma-separated)<Input value={tags} maxLength={800} onChange={(event) => setTags(event.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-medium">Focal X (0–1)<Input type="number" min="0" max="1" step="0.01" value={focalX} onChange={(event) => setFocalX(event.target.value)} /></label><label className="grid gap-1 text-xs font-medium">Focal Y (0–1)<Input type="number" min="0" max="1" step="0.01" value={focalY} onChange={(event) => setFocalY(event.target.value)} /></label></div>
      {item.origin === "ADMIN" ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="size-4 accent-forest-700" />Publicly deliverable</label> : <p className="rounded-lg bg-muted p-3 text-xs">Customer uploads remain private and cannot be published from this library.</p>}
      <section className="grid gap-2"><h3 className="text-sm font-semibold">Where used</h3>{item.usages.length ? item.usages.map((usage) => <p key={usage.id} className="rounded-md bg-muted px-3 py-2 text-xs">{usage.entityType} · {usage.entityId}{usage.field ? ` · ${usage.field}` : ""}</p>) : <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Not currently used by a content record.</p>}</section>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending || Boolean(item.deletedAt)}>{pending ? "Saving…" : "Save details"}</Button>{canDelete && !item.deletedAt ? <ConfirmDialog trigger={<Button type="button" variant="destructive" disabled={pending}>Soft-delete</Button>} title="Soft-delete this asset?" description={item.usages.length ? "This asset is currently in use and deletion will be blocked." : "It will be hidden from the active library and made non-public."} confirmLabel="Soft-delete" destructive onConfirm={remove} /> : null}</div>
    </form>
  </div>;
}

export function MediaLibrary({ items, categories, tags: availableTags, cloudName, canWrite, canDelete, page, pageCount, total, filters }: {
  items: MediaLibraryItem[];
  categories: string[];
  tags: string[];
  cloudName: string;
  canWrite: boolean;
  canDelete: boolean;
  page: number;
  pageCount: number;
  total: number;
  filters: { q: string; kind: string; category: string; tag: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<MediaLibraryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function changePage(nextPage: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(nextPage));
    router.push(`/admin/media?${params.toString()}`);
  }

  return <div className="space-y-6">
    {canWrite ? <section className="grid gap-4 lg:grid-cols-2"><Uploader purpose="admin_image" onComplete={() => router.refresh()} /><Uploader purpose="admin_video" onComplete={() => router.refresh()} /></section> : null}
    <form action="/admin/media" method="get" className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="grid gap-1 text-xs font-medium">Search<Input name="q" defaultValue={filters.q} placeholder="Public ID, caption, tag" /></label>
      <label className="grid gap-1 text-xs font-medium">Kind<select name="kind" defaultValue={filters.kind} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All media</option><option value="IMAGE">Images</option><option value="VIDEO">Videos</option></select></label>
      <label className="grid gap-1 text-xs font-medium">Category<select name="category" defaultValue={filters.category} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium">Tag<select name="tag" defaultValue={filters.tag} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All tags</option>{availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
      <Button type="submit" variant="outline" className="self-end">Apply filters</Button>
    </form>
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{total} media assets</span><span>Page {page} of {pageCount}</span></div>
    {items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{items.map((item) => <button type="button" key={item.id} onClick={() => { setSelected(item); setDrawerOpen(true); }} className="group overflow-hidden rounded-xl border border-border/70 bg-card text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <div className="relative aspect-[4/3] bg-muted">{item.kind === "VIDEO" ? <><CldImage cloudName={cloudName} publicId={item.publicId} alt="" resourceType="video" fill sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 24vw, (min-width: 640px) 32vw, 50vw" className="object-cover" /><span className="absolute bottom-2 left-2 rounded bg-night-900/80 px-2 py-1 text-[10px] text-white">VIDEO</span></> : <CldImage cloudName={cloudName} publicId={item.publicId} alt={localeValue(item.altText, "en")} fill sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 24vw, (min-width: 640px) 32vw, 50vw" focalX={item.focalX} focalY={item.focalY} className="object-cover transition duration-300 group-hover:scale-105" />}{item.deletedAt ? <span className="absolute right-2 top-2 rounded bg-destructive px-2 py-1 text-[10px] text-white">DELETED</span> : null}</div>
      <span className="block truncate px-3 pt-2 text-xs font-medium">{item.category ?? item.kind.toLowerCase()}</span><span className="block truncate px-3 pb-3 text-[10px] text-muted-foreground">{item.tags.join(" · ") || item.publicId}</span>
    </button>)}</div> : <p className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No assets match these filters. Upload an image or video to get started.</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</Button><Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => changePage(page + 1)}>Next</Button></div>
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}><SheetContent className="w-full overflow-hidden p-0 sm:max-w-xl"><SheetHeader><SheetTitle>Media details</SheetTitle><SheetDescription>Localized text, focal position, tags and usage references.</SheetDescription></SheetHeader>{selected ? <MediaDetailEditor key={selected.id} item={selected} cloudName={cloudName} canDelete={canDelete} onSaved={() => setDrawerOpen(false)} onDeleted={() => setDrawerOpen(false)} /> : null}</SheetContent></Sheet>
  </div>;
}
