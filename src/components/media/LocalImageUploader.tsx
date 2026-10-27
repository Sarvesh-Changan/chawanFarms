"use client";

import { useRef, useState, useTransition } from "react";

import { CldImage } from "@/components/media/CldImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMediaBytes, mediaPolicy } from "@/config/media";

export type LocalUploaderMedia = { id: string; publicId: string; format?: string | null; width?: number | null; height?: number | null; altText?: unknown; tags?: string[] };

type Signature = { apiKey: string; uploadEndpoint: string; signature: string; signedParams: Record<string, string | number | boolean>; allowedFormats: string[]; maxBytes: number };

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function altValue(value: unknown): string { return value && typeof value === "object" && !Array.isArray(value) ? text((value as Record<string, unknown>).en) : ""; }
function extension(file: File): string { return file.name.split(".").at(-1)?.toLowerCase() ?? ""; }
function imageFileError(file: File): string | null {
  const policy = mediaPolicy("admin_image");
  if (file.size > policy.maxBytes) return `Maximum file size is ${formatMediaBytes(policy.maxBytes)}.`;
  if (!policy.formats.includes(extension(file))) return `Allowed formats: ${policy.formats.join(", ")}.`;
  if (file.type && !file.type.startsWith("image/")) return "Choose an image file.";
  return null;
}
function upload(endpoint: string, data: FormData, onProgress: (value: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open("POST", endpoint);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    request.onerror = () => reject(new Error("Upload connection failed."));
    request.onload = () => { try { const value = JSON.parse(request.responseText) as unknown; if (request.status >= 200 && request.status < 300) resolve(value); else reject(new Error("Cloudinary could not accept this file.")); } catch { reject(new Error("Cloudinary returned an invalid response.")); } };
    request.send(data);
  });
}
async function readJson(response: Response): Promise<unknown> { return response.json().catch(() => undefined); }

export function LocalImageUploader({ label = "Image", value, media, cloudName, onChange, onRemove, helperText, disabled = false }: {
  label?: string;
  value: string;
  media?: LocalUploaderMedia;
  cloudName?: string;
  onChange: (mediaId: string) => void;
  onRemove: () => void;
  helperText?: string;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState(altValue(media?.altText));
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const policy = mediaPolicy("admin_image");
  const accept = policy.formats.map((format) => `.${format}`).join(",");
  const provisional = media?.tags?.some((tag) => tag === "provisional-pdf" || tag === "provisional-oldsite");

  function choose(file: File | undefined) {
    if (!file) return;
    const error = imageFileError(file);
    if (error) { setMessage(error); return; }
    if (!altText.trim()) { setMessage("English alt text is required before uploading."); return; }
    startTransition(async () => {
      setMessage("Preparing secure upload…"); setProgress(0);
      try {
        const signatureResponse = await fetch("/api/upload-signature", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose: "admin_image" }) });
        const signature = await readJson(signatureResponse) as Partial<Signature>;
        if (!signatureResponse.ok || !signature.apiKey || !signature.uploadEndpoint || !signature.signature || !signature.signedParams) throw new Error("Could not authorize this upload.");
        const data = new FormData(); data.append("file", file); data.append("api_key", signature.apiKey); data.append("signature", signature.signature);
        for (const [key, entry] of Object.entries(signature.signedParams)) data.append(key, String(entry));
        const uploaded = await upload(signature.uploadEndpoint, data, setProgress) as { public_id?: string };
        if (!uploaded.public_id) throw new Error("Cloudinary returned incomplete upload details.");
        const confirmation = await fetch("/api/upload-confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicId: uploaded.public_id, altText: { en: altText.trim() } }) });
        const confirmed = await readJson(confirmation) as { mediaId?: string; error?: string };
        if (!confirmation.ok || !confirmed.mediaId) throw new Error(confirmed.error || "Upload verification is still pending. Refresh and try again.");
        onChange(confirmed.mediaId); setMessage("Photo uploaded and verified. Save the form to attach it.");
        if (fileRef.current) fileRef.current.value = "";
      } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    });
  }

  return <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4" disabled={disabled || pending}>
    <legend className="px-1 text-sm font-semibold">{label}</legend>
    {media && cloudName ? <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-muted"><CldImage cloudName={cloudName} publicId={media.publicId} alt={altValue(media.altText) || altText || label} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />{provisional ? <span className="absolute top-2 left-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">Provisional photo · replace with original</span> : null}</div> : null}
    <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">English alt text<Input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={500} required aria-describedby={`${label}-alt-help`} /></label><div className="grid gap-1 text-xs text-muted-foreground"><span id={`${label}-alt-help`}>Required for accessibility. Marathi and Hindi can be added in the Media library.</span><span>{helperText || `JPG, PNG, WebP or AVIF · up to ${formatMediaBytes(policy.maxBytes)}.`}</span></div></div>
    <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }} className={`grid min-h-24 place-items-center rounded-lg border border-dashed p-4 text-center text-sm ${dragging ? "border-forest-700 bg-muted" : "border-border"}`}><input ref={fileRef} id={`${label.replaceAll(" ", "-")}-file`} type="file" accept={accept} className="sr-only" onChange={(event) => choose(event.target.files?.[0])} /><label htmlFor={`${label.replaceAll(" ", "-")}-file`} className="cursor-pointer underline underline-offset-4">Choose or drag an image here</label></div>
    {pending ? <progress aria-label={`${label} upload progress`} max={100} value={progress} className="h-2 w-full accent-forest-700" /> : null}
    {message ? <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{message}</p> : null}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!value || pending} onClick={() => fileRef.current?.click()}>Replace</Button>{value ? <Button type="button" variant="ghost" disabled={pending} onClick={onRemove}>Remove</Button> : null}</div>
    <span className="sr-only" aria-live="polite">{pending ? `Uploading ${progress}%` : ""}</span>
  </fieldset>;
}
