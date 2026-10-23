"use client";

import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { displayToIsoDate, getKolkataToday } from "@/lib/booking-dates";

type VideoUploaderProps = {
  acceptedFormats: readonly string[];
  maxBytes: number;
  maxDurationSeconds: number;
  formattedMaxBytes: string;
};

type UploadIntent = {
  submissionId: string;
  uploadPublicId: string;
  uploadExpiresAt: string;
  signature: {
    signedParams: Record<string, string | number | boolean>;
    uploadEndpoint: string;
  };
};

function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function todayIso(): string {
  const today = getKolkataToday();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function VideoUploader({ acceptedFormats, maxBytes, maxDurationSeconds, formattedMaxBytes }: VideoUploaderProps) {
  const [visitDate, setVisitDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [consentOwnership, setConsentOwnership] = useState(false);
  const [consentPublish, setConsentPublish] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [intent, setIntent] = useState<UploadIntent | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Choose a video to begin.");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const acceptedLabel = useMemo(() => acceptedFormats.map((format) => format.toUpperCase()).join(", "), [acceptedFormats]);
  const accept = acceptedFormats.map((format) => `.${format}`).join(",");

  function validateForm(): string | null {
    if (!file) return "Choose a video file first.";
    if (!consentOwnership) return "Please confirm that you own the video or have permission to submit it.";
    const isoDate = displayToIsoDate(visitDate);
    if (!isoDate) return "Enter the visit date in DD/MM/YYYY format.";
    if (isoDate > todayIso()) return "Visit date cannot be in the future.";
    const extension = fileExtension(file.name);
    if (!acceptedFormats.includes(extension)) return `Please choose an ${acceptedLabel} video.`;
    if (file.size > maxBytes) return `This video is larger than ${formattedMaxBytes}.`;
    return null;
  }

  async function startIntent(): Promise<UploadIntent | null> {
    const isoDate = displayToIsoDate(visitDate);
    if (!isoDate) return null;
    const response = await fetch("/api/account/videos/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: idempotencyKeyRef.current,
        visitDate: isoDate,
        title: title || undefined,
        description: description || undefined,
        consentOwnership,
        consentPublish,
      }),
    });
    const body = (await response.json()) as UploadIntent & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Unable to start the upload.");
    return body;
  }

  function uploadToCloudinary(currentIntent: UploadIntent, currentFile: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", currentIntent.signature.uploadEndpoint);
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 90));
      });
      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) resolve();
        else reject(new Error("Cloudinary did not accept the video upload."));
      });
      request.addEventListener("error", () => reject(new Error("The video upload was interrupted. You can retry/resume it.")));
      request.addEventListener("abort", () => reject(new Error("The video upload was interrupted. You can retry/resume it.")));
      const form = new FormData();
      for (const [key, value] of Object.entries(currentIntent.signature.signedParams)) form.append(key, String(value));
      form.append("file", currentFile);
      request.send(form);
    });
  }

  async function submitUpload() {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    setError("");
    setComplete(false);
    setProgress(0);
    try {
      setStatus("Checking your upload limits…");
      const currentIntent = await startIntent();
      if (!currentIntent || !file) throw new Error("Unable to start the upload.");
      setIntent(currentIntent);
      setStatus("Uploading securely…");
      await uploadToCloudinary(currentIntent, file);
      setProgress(95);
      setStatus("Verifying the video…");
      const response = await fetch("/api/account/videos/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: currentIntent.submissionId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Video verification failed. The upload was removed.");
      setProgress(100);
      setStatus("Video submitted for review.");
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The upload could not be completed.");
      setStatus("Upload needs attention.");
    } finally {
      setBusy(false);
    }
  }

  function chooseFile(value: File | undefined) {
    setFile(value ?? null);
    setIntent(null);
    setComplete(false);
    setError("");
    setProgress(0);
    setStatus(value ? `Selected ${value.name}.` : "Choose a video to begin.");
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7" aria-labelledby="video-upload-heading">
      <h2 id="video-upload-heading" className="font-heading text-2xl text-forest-900">Upload your video</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Accepted formats: {acceptedLabel}. Maximum {formattedMaxBytes} and {maxDurationSeconds} seconds. These checks improve the experience; the server verifies the actual Cloudinary asset.</p>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium">Visit date (DD/MM/YYYY)
          <Input value={visitDate} onChange={(event) => setVisitDate(event.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric" autoComplete="off" required aria-describedby="visit-date-help" />
          <span id="visit-date-help" className="text-xs font-normal text-muted-foreground">Use the date of your visit, not a future date.</span>
        </label>
        <label className="grid gap-2 text-sm font-medium">Video file
          <Input type="file" accept={accept} onChange={(event) => chooseFile(event.target.files?.[0])} required />
        </label>
        <label className="grid gap-2 text-sm font-medium">Title (optional)
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
        </label>
        <label className="grid gap-2 text-sm font-medium">Description (optional)
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2_000} />
        </label>
        <label className="flex gap-3 text-sm leading-6">
          <input type="checkbox" className="mt-1 size-4 accent-forest-700" checked={consentOwnership} onChange={(event) => setConsentOwnership(event.target.checked)} required />
          <span>I confirm that I own this video or have permission to submit it. I have permission from other guests shown in it, and from a parent or guardian for any child shown.</span>
        </label>
        <label className="flex gap-3 text-sm leading-6">
          <input type="checkbox" className="mt-1 size-4 accent-forest-700" checked={consentPublish} onChange={(event) => setConsentPublish(event.target.checked)} />
          <span>I separately allow Chawan Farms to publish this video on its website or social channels. This is optional and is not required for review.</span>
        </label>
        <div className="grid gap-2" aria-live="polite" aria-atomic="true">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{status}</span><span>{progress}%</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Video upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full bg-forest-700 transition-[width]" style={{ width: `${progress}%` }} /></div>
        </div>
        {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        {complete ? <p role="status" className="rounded-lg bg-leaf-500/10 p-3 text-sm text-forest-900">Thanks. Your video is private and pending review.</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void submitUpload()} disabled={busy || complete}>{busy ? "Uploading…" : intent && error ? "Retry / resume upload" : "Submit video"}</Button>
          {intent && error ? <span className="self-center text-xs text-muted-foreground">Your upload intent is reused until it expires.</span> : null}
        </div>
      </div>
    </section>
  );
}
