"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

import { CldImage } from "@/components/media/CldImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMediaBytes, mediaPolicy } from "@/config/media";

export type LocalUploaderMedia = { id: string; publicId: string; format?: string | null; width?: number | null; height?: number | null; altText?: unknown; tags?: string[] };
type Signature = { apiKey: string; uploadEndpoint: string; signature: string; signedParams: Record<string, string | number | boolean>; allowedFormats: string[]; maxBytes: number };

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function altValue(value: unknown): string { return value && typeof value === "object" && !Array.isArray(value) ? text((value as Record<string, unknown>).en) : ""; }
function extension(file: File): string { return file.name.split(".").at(-1)?.toLowerCase() ?? ""; }
function imageFileError(file: File): string | null { const policy = mediaPolicy("admin_image"); if (file.size > policy.maxBytes) return `Maximum file size is ${formatMediaBytes(policy.maxBytes)}.`; if (!policy.formats.includes(extension(file))) return `Allowed formats: ${policy.formats.join(", ")}.`; if (file.type && !file.type.startsWith("image/")) return "Choose an image file."; return null; }
function upload(endpoint: string, data: FormData, onProgress: (value: number) => void): Promise<unknown> { return new Promise((resolve, reject) => { const request = new XMLHttpRequest(); request.open("POST", endpoint); request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); }; request.onerror = () => reject(new Error("Upload connection failed.")); request.onload = () => { try { const value = JSON.parse(request.responseText) as unknown; if (request.status >= 200 && request.status < 300) resolve(value); else reject(new Error("Cloudinary could not accept this file.")); } catch { reject(new Error("Cloudinary returned an invalid response.")); } }; request.send(data); }); }
async function readJson(response: Response): Promise<unknown> { return response.json().catch(() => undefined); }
async function uploadVerifiedImage(file: File, altText: string, onProgress: (value: number) => void): Promise<{ mediaId: string; publicId: string }> {
  const signatureResponse = await fetch("/api/upload-signature", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose: "admin_image" }) });
  const signature = await readJson(signatureResponse) as Partial<Signature>;
  if (!signatureResponse.ok || !signature.apiKey || !signature.uploadEndpoint || !signature.signature || !signature.signedParams) throw new Error("Could not authorize this upload.");
  const data = new FormData(); data.append("file", file); data.append("api_key", signature.apiKey); data.append("signature", signature.signature); for (const [key, entry] of Object.entries(signature.signedParams)) data.append(key, String(entry));
  const uploaded = await upload(signature.uploadEndpoint, data, onProgress) as { public_id?: string };
  const publicId = uploaded.public_id;
  if (!publicId) throw new Error("Cloudinary returned incomplete upload details.");
  const confirmation = await fetch("/api/upload-confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicId, ...(altText.trim() ? { altText: { en: altText.trim() } } : {}) }) });
  const confirmed = await readJson(confirmation) as { mediaId?: string; error?: string };
  if (!confirmation.ok || !confirmed.mediaId) throw new Error(confirmed.error || "Upload verification is still pending. Refresh and try again.");
  return { mediaId: confirmed.mediaId, publicId };
}

export function LocalImageUploader({ label = "Image", value, media, cloudName, onChange, onRemove, helperText, disabled = false }: { label?: string; value: string; media?: LocalUploaderMedia; cloudName?: string; onChange: (mediaId: string) => void; onRemove: () => void; helperText?: string; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadedMedia, setUploadedMedia] = useState<LocalUploaderMedia>();
  const [localPreview, setLocalPreview] = useState<{ url: string; name: string }>();
  const [altText, setAltText] = useState(altValue(media?.altText));
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const policy = mediaPolicy("admin_image");
  const accept = policy.formats.map((format) => `.${format}`).join(",");
  const currentMedia = uploadedMedia?.id === value ? uploadedMedia : media;
  const provisional = currentMedia?.tags?.some((tag) => tag === "provisional-pdf" || tag === "provisional-oldsite");

  useEffect(() => () => {
    if (localPreview?.url) URL.revokeObjectURL(localPreview.url);
  }, [localPreview?.url]);

  function choose(file: File | undefined) {
    if (!file) return;
    const error = imageFileError(file);
    if (error) { setMessage(error); return; }
    setLocalPreview({ url: URL.createObjectURL(file), name: file.name });
    startTransition(async () => {
      setMessage("Preparing secure upload..."); setProgress(0);
      try {
        const result = await uploadVerifiedImage(file, altText, setProgress);
        setUploadedMedia({ id: result.mediaId, publicId: result.publicId, format: extension(file), altText: { en: altText.trim() } });
        onChange(result.mediaId); setMessage("Photo uploaded and verified. Save the form to attach it.");
        if (fileRef.current) fileRef.current.value = "";
      } catch (uploadError) { setMessage(uploadError instanceof Error ? uploadError.message : "Upload failed."); }
    });
  }

  return <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4" disabled={disabled || pending}>
    <legend className="px-1 text-sm font-semibold">{label}</legend>
    {localPreview || (currentMedia && cloudName) ? <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-muted">{localPreview ? <Image src={localPreview.url} alt={altText || localPreview.name || label} fill unoptimized sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /> : currentMedia && cloudName ? <CldImage cloudName={cloudName} publicId={currentMedia.publicId} alt={altValue(currentMedia.altText) || altText || label} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /> : null}{localPreview && uploadedMedia?.id === value ? <span className="absolute left-2 top-2 rounded-full bg-forest-900/85 px-2 py-1 text-xs font-semibold text-cream-50">Uploaded preview</span> : null}{!localPreview && provisional ? <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">Provisional photo - replace with original</span> : null}</div> : null}
    {localPreview ? <p className="truncate text-xs text-muted-foreground" title={localPreview.name}>Selected image: {localPreview.name}</p> : null}
    <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">English alt text (optional)<Input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={500} aria-describedby={`${label}-alt-help`} /></label><div className="grid gap-1 text-xs text-muted-foreground"><span id={`${label}-alt-help`}>Optional. Add a short description when available.</span><span>{helperText || `JPG, PNG, WebP or AVIF - up to ${formatMediaBytes(policy.maxBytes)}.`}</span></div></div>
    <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }} className={`grid min-h-24 place-items-center rounded-lg border border-dashed p-4 text-center text-sm ${dragging ? "border-forest-700 bg-muted" : "border-border"}`}><input ref={fileRef} id={`${label.replaceAll(" ", "-")}-file`} type="file" accept={accept} className="sr-only" onChange={(event) => choose(event.target.files?.[0])} /><label htmlFor={`${label.replaceAll(" ", "-")}-file`} className="cursor-pointer underline underline-offset-4">Choose or drag an image here</label></div>
    {pending ? <progress aria-label={`${label} upload progress`} max={100} value={progress} className="h-2 w-full accent-forest-700" /> : null}
    {message ? <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{message}</p> : null}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!value || pending} onClick={() => fileRef.current?.click()}>Replace</Button>{value ? <Button type="button" variant="ghost" disabled={pending} onClick={() => { setLocalPreview(undefined); onRemove(); }}>Remove</Button> : null}</div>
    <span className="sr-only" aria-live="polite">{pending ? `Uploading ${progress}%` : ""}</span>
  </fieldset>;
}

type BatchImage = { key: string; file: File; name: string; previewUrl: string; mediaId?: string; status: "uploading" | "uploaded" | "error"; error?: string };

export function LocalImageBatchUploader({ value, onChange, onMediaChange, maxFiles = 8, disabled = false }: { value: string[]; onChange: (mediaIds: string[]) => void; onMediaChange?: (media: LocalUploaderMedia[]) => void; maxFiles?: number; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<BatchImage[]>([]);
  const verifiedMediaRef = useRef<LocalUploaderMedia[]>([]);
  const valueRef = useRef(value);
  const [items, setItems] = useState<BatchImage[]>([]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const policy = mediaPolicy("admin_image");
  const accept = policy.formats.map((format) => `.${format}`).join(",");
  const remaining = Math.max(0, maxFiles - value.length - items.filter((item) => !item.mediaId).length);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => () => { for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl); }, []);

  function updateItems(updater: (current: BatchImage[]) => BatchImage[]) {
    setItems((current) => { const next = updater(current); itemsRef.current = next; return next; });
  }

  function choose(files: FileList | File[] | undefined) {
    if (!files || !remaining) {
      setMessage(remaining ? "Choose image files to upload." : `You can add up to ${maxFiles} photos.`);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    const rejected = Array.from(files).length - selected.length;
    const valid: Array<{ file: File; error?: string }> = selected.map((file) => ({ file, error: imageFileError(file) ?? undefined }));
    const invalid = valid.filter((entry): entry is { file: File; error: string } => Boolean(entry.error));
    const accepted = valid.filter((entry): entry is { file: File } => !entry.error);
    if (invalid.length || rejected) setMessage(`${invalid.length + rejected} file${invalid.length + rejected === 1 ? "" : "s"} skipped. Check the image format, size and remaining photo limit.`);
    if (!accepted.length) return;
    const newItems = accepted.map(({ file }, index) => ({ key: `${Date.now()}-${index}-${file.name}`, file, name: file.name, previewUrl: URL.createObjectURL(file), status: "uploading" as const }));
    updateItems((current) => [...current, ...newItems]);
    startTransition(async () => {
      let completed = 0;
      for (const item of newItems) {
        try {
          const result = await uploadVerifiedImage(item.file, "", (fileProgress) => setProgress(Math.round(((completed + fileProgress / 100) / newItems.length) * 100)));
          updateItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, mediaId: result.mediaId, status: "uploaded" } : entry));
          verifiedMediaRef.current = [...verifiedMediaRef.current, { id: result.mediaId, publicId: result.publicId, format: extension(item.file) }];
          onMediaChange?.(verifiedMediaRef.current);
          const next = [...new Set([...valueRef.current, result.mediaId])].slice(0, maxFiles);
          valueRef.current = next;
          onChange(next);
        } catch (error) {
          updateItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, status: "error", error: error instanceof Error ? error.message : "Upload failed." } : entry));
        }
        completed += 1;
        setProgress(Math.round((completed / newItems.length) * 100));
      }
      setMessage("Selected photos uploaded and verified. Save the story to attach them.");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function remove(item: BatchImage) {
    if (item.mediaId) {
      const next = valueRef.current.filter((id) => id !== item.mediaId);
      valueRef.current = next;
      onChange(next);
      verifiedMediaRef.current = verifiedMediaRef.current.filter((media) => media.id !== item.mediaId);
      onMediaChange?.(verifiedMediaRef.current);
    }
    URL.revokeObjectURL(item.previewUrl);
    updateItems((current) => current.filter((entry) => entry.key !== item.key));
  }

  return <fieldset className="grid gap-3 rounded-xl border border-dashed border-border/70 p-4" disabled={disabled || pending}>
    <legend className="px-1 text-sm font-semibold">Upload multiple photos</legend>
    <p className="text-xs text-muted-foreground">Select or drag several images at once. Up to {maxFiles} photos total.</p>
    <input ref={fileRef} id="story-multiple-photos" type="file" accept={accept} multiple className="sr-only" onChange={(event) => choose(event.target.files ?? undefined)} />
    <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files); }} className="grid min-h-20 place-items-center rounded-lg border border-dashed border-border p-4 text-center text-sm"><label htmlFor="story-multiple-photos" className="cursor-pointer underline underline-offset-4">Choose or drag multiple images here</label></div>
    {items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map((item) => <div key={item.key} className="space-y-2"><div className="relative aspect-square overflow-hidden rounded-lg bg-muted"><Image src={item.previewUrl} alt={item.name} fill unoptimized sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" /><span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.status === "uploaded" ? "bg-forest-900/85 text-cream-50" : item.status === "error" ? "bg-destructive text-destructive-foreground" : "bg-black/70 text-white"}`}>{item.status === "uploaded" ? "Uploaded" : item.status === "error" ? "Error" : "Uploading"}</span></div><p className="truncate text-xs" title={item.name}>{item.name}</p>{item.error ? <p className="text-xs text-destructive" role="status">{item.error}</p> : null}<Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => remove(item)}>Remove</Button></div>)}</div> : null}
    {pending ? <progress aria-label="Multiple photo upload progress" max={100} value={progress} className="h-2 w-full accent-forest-700" /> : null}
    {message ? <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{message}</p> : null}
  </fieldset>;
}
