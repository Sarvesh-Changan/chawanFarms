"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEDIA_FILE_METADATA_TIMEOUT_MS, formatMediaBytes, mediaPolicy, type MediaPurpose } from "@/config/media";

const signatureSchema = z.object({
  cloudName: z.string().min(1),
  apiKey: z.string().min(1),
  resourceType: z.enum(["image", "video"]),
  signature: z.string().min(1),
  uploadEndpoint: z.string().url(),
  allowedFormats: z.array(z.string()),
  maxBytes: z.number().int().positive(),
  maxDurationSeconds: z.number().int().positive().optional(),
  signedParams: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
}).passthrough();
const cloudinaryUploadResponseSchema = z.object({ public_id: z.string().min(1), resource_type: z.enum(["image", "video", "raw"]) }).passthrough();
const confirmationResponseSchema = z.object({ mediaId: z.string().uuid() }).strict();

function fileExtension(file: File): string {
  return file.name.split(".").at(-1)?.toLowerCase() ?? "";
}

async function readVideoDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const timeout = window.setTimeout(() => reject(new Error("Could not read video duration.")), MEDIA_FILE_METADATA_TIMEOUT_MS);
      video.preload = "metadata";
      video.onloadedmetadata = () => { window.clearTimeout(timeout); resolve(video.duration); };
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error("Could not read video duration.")); };
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cloudinaryUpload(endpoint: string, data: FormData, onProgress: (percent: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Upload connection failed."));
    request.onload = () => {
      let response: unknown;
      try { response = JSON.parse(request.responseText); } catch { response = undefined; }
      if (request.status >= 200 && request.status < 300) resolve(response);
      else reject(new Error("Cloudinary could not accept this file."));
    };
    request.send(data);
  });
}

export function Uploader({ purpose, onComplete }: { purpose: MediaPurpose; onComplete?: (mediaId: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const policy = mediaPolicy(purpose);
  const accept = policy.formats.map((format) => `.${format}`).join(",");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setMessage("Choose a file to upload.");
    if (file.size > policy.maxBytes) return setMessage(`Maximum file size is ${formatMediaBytes(policy.maxBytes)}.`);
    if (!policy.formats.includes(fileExtension(file))) return setMessage(`Allowed formats: ${policy.formats.join(", ")}.`);

    startTransition(async () => {
      setProgress(0);
      setMessage("Preparing secure upload…");
      try {
        if (policy.maxDurationSeconds !== undefined) {
          const duration = await readVideoDuration(file);
          if (!Number.isFinite(duration) || duration > policy.maxDurationSeconds) {
            setMessage(`Maximum video duration is ${policy.maxDurationSeconds} seconds.`);
            return;
          }
        }
        const signatureResponse = await fetch("/api/upload-signature", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ purpose }),
        });
        const signature = signatureSchema.safeParse(await signatureResponse.json().catch(() => undefined));
        if (!signatureResponse.ok || !signature.success) throw new Error("Could not authorize this upload.");

        const form = new FormData();
        form.append("file", file);
        form.append("api_key", signature.data.apiKey);
        form.append("signature", signature.data.signature);
        for (const [key, value] of Object.entries(signature.data.signedParams)) form.append(key, String(value));
        const uploaded = cloudinaryUpload(signature.data.uploadEndpoint, form, setProgress);
        const cloudinaryResponse = cloudinaryUploadResponseSchema.safeParse(await uploaded);
        if (!cloudinaryResponse.success) throw new Error("Cloudinary returned incomplete upload details.");

        const confirmation = await fetch("/api/upload-confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ publicId: cloudinaryResponse.data.public_id }),
        });
        const confirmed = confirmationResponseSchema.safeParse(await confirmation.json().catch(() => undefined));
        if (!confirmation.ok || !confirmed.success) throw new Error("Upload received; server verification is still pending. Refresh the library shortly.");
        setMessage("Upload verified and added to the media library.");
        if (fileRef.current) fileRef.current.value = "";
        onComplete?.(confirmed.data.mediaId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  return <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end">
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium" htmlFor={`media-upload-${purpose}`}>Upload {purpose.replaceAll("_", " ")}
        <Input ref={fileRef} id={`media-upload-${purpose}`} type="file" accept={accept} required disabled={pending} />
      </label>
      <p className="text-xs text-muted-foreground">{policy.formats.join(", ")} · up to {formatMediaBytes(policy.maxBytes)}{policy.maxDurationSeconds ? ` · ${policy.maxDurationSeconds}s max` : ""}. Server verifies the resulting asset.</p>
      {pending ? <progress aria-label="Upload progress" max={100} value={progress} className="h-2 w-full accent-forest-700" /> : null}
      {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
    <Button type="submit" disabled={pending}>{pending ? `Uploading ${progress}%` : "Upload file"}</Button>
  </form>;
}
