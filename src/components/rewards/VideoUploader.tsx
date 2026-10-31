"use client";

import {
  Calendar as CalendarIcon,
  CheckCircle2,
  FileVideo,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMediaBytes } from "@/config/media";
import {
  formatDateDDMMYYYY,
  getKolkataToday,
  parseDateDDMMYYYY,
} from "@/lib/booking-dates";

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
    apiKey: string;
    signature: string;
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
  const [showCalendar, setShowCalendar] = useState(false);
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

  function parseFlexibleDate(val: string): Date | null {
    if (!val) return null;
    const trimmed = val.trim();
    const parsed = parseDateDDMMYYYY(trimmed);
    if (parsed) return parsed;
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]);
      const d = Number(isoMatch[3]);
      const dt = new Date(y, m - 1, d);
      if (!isNaN(dt.getTime())) return dt;
    }
    return null;
  }

  function getEffectiveIsoDate(): string | null {
    const d = parseFlexibleDate(visitDate);
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function validateForm(): string | null {
    if (!file) return "Please choose a video file first.";
    const isoDate = getEffectiveIsoDate();
    if (!isoDate) return "Please select or enter the date of your visit in DD/MM/YYYY format.";
    if (isoDate > todayIso()) return "Visit date cannot be in the future.";
    if (!consentOwnership) return "Please confirm that you own the video or have permission to submit it.";
    const extension = fileExtension(file.name);
    if (!acceptedFormats.includes(extension)) return `Please choose an ${acceptedLabel} video.`;
    if (file.size > maxBytes) return `This video is ${formatMediaBytes(file.size)}, which exceeds the maximum of ${formattedMaxBytes}.`;
    return null;
  }

  async function startIntent(): Promise<UploadIntent | null> {
    const isoDate = getEffectiveIsoDate();
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

      request.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const pct = Math.min(90, Math.max(1, Math.round((event.loaded / event.total) * 90)));
          setProgress(pct);
          const loadedStr = formatMediaBytes(event.loaded);
          const totalStr = formatMediaBytes(event.total);
          setStatus(`Uploading video… ${pct}% (${loadedStr} of ${totalStr})`);
        }
      };

      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
        } else {
          let msg = `Cloudinary rejected the upload (${request.status}).`;
          try {
            const errObj = JSON.parse(request.responseText) as { error?: { message?: string } };
            if (errObj.error?.message) {
              msg = `Upload rejected: ${errObj.error.message}`;
            }
          } catch {
            // keep fallback message
          }
          reject(new Error(msg));
        }
      };

      request.onerror = () => reject(new Error("The video upload was interrupted by a network error. You can retry."));
      request.ontimeout = () => reject(new Error("The upload timed out. Please check your internet connection."));
      request.onabort = () => reject(new Error("The video upload was aborted."));

      const form = new FormData();
      form.append("file", currentFile);
      if (currentIntent.signature.apiKey) {
        form.append("api_key", currentIntent.signature.apiKey);
      }
      if (currentIntent.signature.signature) {
        form.append("signature", currentIntent.signature.signature);
      }
      for (const [key, value] of Object.entries(currentIntent.signature.signedParams)) {
        form.append(key, String(value));
      }

      request.send(form);
    });
  }

  async function submitUpload() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError("");
    setComplete(false);
    setProgress(0);
    try {
      setStatus("Checking upload limits…");
      const currentIntent = await startIntent();
      if (!currentIntent || !file) throw new Error("Unable to start the upload.");
      setIntent(currentIntent);
      setStatus("Uploading video securely…");
      await uploadToCloudinary(currentIntent, file);
      setProgress(95);
      setStatus("Verifying video asset…");
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
    setStatus(value ? `Selected ${value.name} (${formatMediaBytes(value.size)}).` : "Choose a video to begin.");
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7" aria-labelledby="video-upload-heading">
      <h2 id="video-upload-heading" className="font-heading text-2xl text-forest-900">Upload your video</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Accepted formats: {acceptedLabel}. Maximum {formattedMaxBytes} and {maxDurationSeconds} seconds.
      </p>

      <div className="mt-5 grid gap-5">
        {/* Visit Date Field with Calendar Picker */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="visit-date-input" className="text-sm font-medium">
              Visit date (DD/MM/YYYY) <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2 text-xs text-forest-700">
              <button
                type="button"
                className="underline hover:text-forest-900"
                onClick={() => {
                  const today = getKolkataToday();
                  setVisitDate(formatDateDDMMYYYY(today));
                  setShowCalendar(false);
                  setError("");
                }}
              >
                Today
              </button>
              <span>•</span>
              <button
                type="button"
                className="underline hover:text-forest-900"
                onClick={() => {
                  const y = getKolkataToday();
                  y.setDate(y.getDate() - 1);
                  setVisitDate(formatDateDDMMYYYY(y));
                  setShowCalendar(false);
                  setError("");
                }}
              >
                Yesterday
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <Input
              id="visit-date-input"
              value={visitDate}
              onChange={(e) => {
                setVisitDate(e.target.value);
                setError("");
              }}
              placeholder="DD/MM/YYYY"
              autoComplete="off"
              className="pr-10"
              aria-describedby="visit-date-help"
              required
            />
            <button
              type="button"
              onClick={() => setShowCalendar((prev) => !prev)}
              aria-label={showCalendar ? "Hide calendar" : "Open calendar"}
              className="absolute right-3 text-muted-foreground hover:text-forest-900 focus:outline-none"
              title="Select date from calendar"
            >
              <CalendarIcon className="size-4" />
            </button>
          </div>
          <span id="visit-date-help" className="text-xs text-muted-foreground">
            Select or enter the date of your stay or visit (cannot be in the future).
          </span>

          {showCalendar && (
            <div className="mt-1 rounded-xl border border-border/80 bg-background p-3 shadow-md inline-block max-w-fit">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Select Visit Date</span>
                <button
                  type="button"
                  className="text-xs underline hover:text-foreground"
                  onClick={() => setShowCalendar(false)}
                >
                  Close
                </button>
              </div>
              <DayPicker
                mode="single"
                selected={parseFlexibleDate(visitDate) ?? undefined}
                onSelect={(day) => {
                  if (day) {
                    setVisitDate(formatDateDDMMYYYY(day));
                    setShowCalendar(false);
                    setError("");
                  }
                }}
                disabled={{ after: new Date() }}
                timeZone="Asia/Kolkata"
              />
            </div>
          )}
        </div>

        {/* Video File Field */}
        <div className="grid gap-2">
          <label className="text-sm font-medium">
            Video file <span className="text-destructive">*</span>
          </label>
          <Input
            type="file"
            accept={accept}
            disabled={busy}
            onChange={(event) => chooseFile(event.target.files?.[0])}
            required
          />
          {file ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs">
              <FileVideo className="size-4 shrink-0 text-forest-700" />
              <div className="flex-1 truncate">
                <span className="font-medium text-foreground">{file.name}</span>{" "}
                <span className="text-muted-foreground">({formatMediaBytes(file.size)})</span>
              </div>
              <span className="rounded-full bg-forest-900/10 px-2 py-0.5 text-[11px] font-medium text-forest-800">
                Ready to submit
              </span>
            </div>
          ) : null}
        </div>

        {/* Title Field */}
        <label className="grid gap-2 text-sm font-medium">
          Title (optional)
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Morning walk through the paddy fields"
            maxLength={160}
          />
        </label>

        {/* Description Field */}
        <label className="grid gap-2 text-sm font-medium">
          Description (optional)
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add details about your stay, activities, or experience…"
            maxLength={2_000}
          />
        </label>

        {/* Consents */}
        <label className="flex gap-3 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-forest-700"
            checked={consentOwnership}
            onChange={(event) => {
              setConsentOwnership(event.target.checked);
              setError("");
            }}
            required
          />
          <span>
            I confirm that I own this video or have permission to submit it. I have permission from other guests shown in it, and from a parent or guardian for any child shown.
          </span>
        </label>

        <label className="flex gap-3 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-forest-700"
            checked={consentPublish}
            onChange={(event) => setConsentPublish(event.target.checked)}
          />
          <span>
            I separately allow Chawan Farms to publish this video on its website or social channels. This is optional and is not required for review.
          </span>
        </label>

        {/* Progress Bar (Visible during or after upload) */}
        {(busy || progress > 0 || complete) ? (
          <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/30 p-3" aria-live="polite" aria-atomic="true">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-foreground flex items-center gap-1.5">
                {busy ? <Loader2 className="size-3.5 animate-spin text-forest-700" /> : null}
                {complete ? <CheckCircle2 className="size-3.5 text-forest-700" /> : null}
                {status}
              </span>
              <span className="font-mono text-forest-900">{progress}%</span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Video upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full bg-forest-700 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {complete ? (
          <p role="status" className="rounded-lg bg-leaf-500/10 p-3 text-sm text-forest-900">
            Thanks! Your video has been uploaded and is pending review by our team.
          </p>
        ) : null}

        {/* Submit Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            onClick={() => void submitUpload()}
            disabled={busy || complete}
            className="bg-forest-900 text-cream-50 hover:bg-forest-700 shadow-sm font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Uploading ({progress}%)…
              </>
            ) : intent && error ? (
              "Retry upload"
            ) : (
              "Submit video"
            )}
          </Button>

          {complete ? (
            <Button asChild variant="outline">
              <Link href="/account/videos">View your submissions</Link>
            </Button>
          ) : null}

          {intent && error ? (
            <span className="text-xs text-muted-foreground">
              Your upload intent is preserved and can be resumed.
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
