"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatMediaBytes, mediaPolicy } from "@/config/media";

type Signature = { apiKey: string; uploadEndpoint: string; signature: string; signedParams: Record<string, string | number | boolean> };

function extension(file: File): string { return file.name.split(".").at(-1)?.toLowerCase() ?? ""; }
function upload(endpoint: string, data: FormData, onProgress: (value: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open("POST", endpoint);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    request.onerror = () => reject(new Error("Upload connection failed."));
    request.onload = () => { try { const value = JSON.parse(request.responseText) as unknown; if (request.status >= 200 && request.status < 300) resolve(value); else reject(new Error("Cloudinary could not accept this file.")); } catch { reject(new Error("Cloudinary returned an invalid response.")); } };
    request.send(data);
  });
}

export function LocalVideoUploader({ label = "Video", value, publicId, cloudName, onChange, onRemove, description = "", disabled = false }: { label?: string; value: string; publicId?: string; cloudName?: string; onChange: (mediaId: string) => void; onRemove: () => void; description?: string; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(description);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const policy = mediaPolicy("admin_video");
  const accept = policy.formats.map((format) => `.${format}`).join(",");

  function choose(file: File | undefined) {
    if (!file) return;
    if (file.size > policy.maxBytes) return setMessage(`Maximum file size is ${formatMediaBytes(policy.maxBytes)}.`);
    if (!policy.formats.includes(extension(file)) || (file.type && !file.type.startsWith("video/"))) return setMessage(`Allowed formats: ${policy.formats.join(", ")}.`);
    if (!text.trim()) return setMessage("A description is required for accessibility.");
    startTransition(async () => {
      setProgress(0); setMessage("Preparing secure upload…");
      try {
        const signatureResponse = await fetch("/api/upload-signature", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose: "admin_video" }) });
        const signature = await signatureResponse.json().catch(() => undefined) as Partial<Signature>;
        if (!signatureResponse.ok || !signature.apiKey || !signature.uploadEndpoint || !signature.signature || !signature.signedParams) throw new Error("Could not authorize this upload.");
        const data = new FormData(); data.append("file", file); data.append("api_key", signature.apiKey); data.append("signature", signature.signature); for (const [key, entry] of Object.entries(signature.signedParams)) data.append(key, String(entry));
        const uploaded = await upload(signature.uploadEndpoint, data, setProgress) as { public_id?: string };
        if (!uploaded.public_id) throw new Error("Cloudinary returned incomplete upload details.");
        const response = await fetch("/api/upload-confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicId: uploaded.public_id, description: text.trim() }) });
        const result = await response.json().catch(() => undefined) as { mediaId?: string; error?: string };
        if (!response.ok || !result.mediaId) throw new Error(result.error || "Upload verification is still pending.");
        onChange(result.mediaId); setMessage("Video uploaded and verified. Save the form to attach it."); if (fileRef.current) fileRef.current.value = "";
      } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    });
  }

  return <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4" disabled={disabled || pending}>
    <legend className="px-1 text-sm font-semibold">{label}</legend>
    {publicId && cloudName ? <video controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" poster={`https://res.cloudinary.com/${encodeURIComponent(cloudName)}/video/upload/so_0,f_jpg/${publicId}.jpg`} src={`https://res.cloudinary.com/${encodeURIComponent(cloudName)}/video/upload/f_auto,q_auto/${publicId}`} aria-label={text || label} /> : null}
    <label className="grid gap-1 text-xs font-medium">Description (required)<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={500} required className="min-h-20 rounded-md border border-input bg-background p-3 text-sm" /><span className="font-normal text-muted-foreground">Describe the video for people who cannot see it. MP4 or WebM · up to {formatMediaBytes(policy.maxBytes)} · {policy.maxDurationSeconds}s max.</span></label>
    <input ref={fileRef} id={`${label.replaceAll(" ", "-")}-file`} type="file" accept={accept} className="sr-only" onChange={(event) => choose(event.target.files?.[0])} />
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>{value ? "Replace video" : "Choose video"}</Button>{value ? <Button type="button" variant="ghost" onClick={onRemove}>Remove</Button> : null}</div>
    {pending ? <progress aria-label={`${label} upload progress`} max={100} value={progress} className="h-2 w-full accent-forest-700" /> : null}{message ? <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{message}</p> : null}
  </fieldset>;
}
