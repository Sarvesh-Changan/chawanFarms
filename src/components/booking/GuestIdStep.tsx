/* eslint-disable security/detect-object-injection */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  ALLOWED_GUEST_ID_FORMATS,
  GUEST_ID_TYPES,
  MAX_GUEST_ID_FILE_BYTES,
  ID_RETENTION_DAYS_AFTER_CHECKOUT,
  getIdTypesForAgeGroup,
} from "@/config/booking-id";
import type { BookingGuestAgeGroup } from "@/generated/prisma/client";
import {
  createGuestIdSignatureAction,
  verifyGuestIdUploadAction,
  removeGuestIdUploadAction,
} from "@/server/actions/booking-id";

export type GuestIdEntry = {
  guestIndex: number;
  label: string;
  ageGroup: BookingGuestAgeGroup;
  fullName: string;
  idType: string;
  mediaPublicId: string;
  mediaId: string;
  fileName: string;
  bytes: number;
  format: string;
};

type GuestIdStepProps = {
  draftKey: string;
  adults: number;
  children4to10: number;
  infantsUnder4: number;
  entries: GuestIdEntry[];
  idConsentAccepted: boolean;
  onEntriesChange: (entries: GuestIdEntry[]) => void;
  onConsentChange: (accepted: boolean) => void;
};

type UploadStatus = "idle" | "uploading" | "verifying" | "done" | "error";

function formatBytes(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export function GuestIdStep({
  draftKey,
  adults,
  children4to10,
  infantsUnder4,
  entries,
  idConsentAccepted,
  onEntriesChange,
  onConsentChange,
}: GuestIdStepProps) {
  // Build the guest slot list (order: adults first, then children, then infants)
  const guestSlots = useMemo(
    () => [
      ...Array.from({ length: adults }, (_, i) => ({
        ageGroup: "ADULT" as const,
        label: `Adult ${i + 1}`,
      })),
      ...Array.from({ length: children4to10 }, (_, i) => ({
        ageGroup: "CHILD_4_10" as const,
        label: `Child ${i + 1} (4–10 yrs)`,
      })),
      ...Array.from({ length: infantsUnder4 }, (_, i) => ({
        ageGroup: "INFANT_UNDER_4" as const,
        label: `Infant ${i + 1} (under 4 yrs)`,
      })),
    ],
    [adults, children4to10, infantsUnder4],
  );

  const [names, setNames] = useState<string[]>(
    guestSlots.map((_, i) => entries[i]?.fullName ?? ""),
  );
  const [idTypes, setIdTypes] = useState<string[]>(
    guestSlots.map((slot, i) => entries[i]?.idType ?? getIdTypesForAgeGroup(slot.ageGroup)[0]?.key ?? "AADHAAR"),
  );
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>(
    guestSlots.map((_, i) => (entries[i]?.mediaPublicId ? "done" : "idle")),
  );
  const [uploadErrors, setUploadErrors] = useState<(string | null)[]>(
    guestSlots.map(() => null),
  );
  const [uploadProgress, setUploadProgress] = useState<number[]>(
    guestSlots.map(() => 0),
  );
  const [uploadAnnounce, setUploadAnnounce] = useState<string[]>(
    guestSlots.map(() => ""),
  );

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setAt = <T,>(arr: T[], idx: number, val: T): T[] => {
    const next = [...arr];
    next[idx] = val;
    return next;
  };

  const announce = useCallback((idx: number, msg: string) => {
    setUploadAnnounce((prev) => setAt(prev, idx, msg));
  }, []);

  const handleFileSelect = useCallback(
    async (idx: number, file: File) => {
      // Client-side pre-checks (UX only — server re-verifies)
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_GUEST_ID_FORMATS.includes(ext as (typeof ALLOWED_GUEST_ID_FORMATS)[number])) {
        setUploadErrors((prev) =>
          setAt(prev, idx, `Format .${ext} is not allowed. Use JPG, PNG, WebP or PDF.`),
        );
        return;
      }
      if (file.size > MAX_GUEST_ID_FILE_BYTES) {
        setUploadErrors((prev) => setAt(prev, idx, "File must be under 5 MB."));
        return;
      }

      setUploadErrors((prev) => setAt(prev, idx, null));
      setUploadStatuses((prev) => setAt(prev, idx, "uploading"));
      setUploadProgress((prev) => setAt(prev, idx, 0));
      announce(idx, "Getting secure upload credentials…");

      // Remove any previous upload for this slot
      const prevEntry = entries[idx];
      if (prevEntry?.mediaPublicId) {
        await removeGuestIdUploadAction({
          draftKey,
          publicId: prevEntry.mediaPublicId,
        }).catch(() => undefined);
        // Optimistically clear entry
        onEntriesChange(entries.map((e, i) => (i === idx ? { ...e, mediaPublicId: "", mediaId: "" } : e)));
      }

      // 1. Obtain signed upload credentials
      const sigResult = await createGuestIdSignatureAction(draftKey);
      if (!sigResult.ok) {
        setUploadStatuses((prev) => setAt(prev, idx, "error"));
        setUploadErrors((prev) => setAt(prev, idx, sigResult.error));
        announce(idx, `Error: ${sigResult.error}`);
        return;
      }

      const { publicId, apiKey, uploadEndpoint, signature, signedParams, maxBytes } = sigResult.data;

      if (file.size > maxBytes) {
        setUploadStatuses((prev) => setAt(prev, idx, "error"));
        setUploadErrors((prev) => setAt(prev, idx, "File must be under 5 MB."));
        announce(idx, "Error: File must be under 5 MB.");
        return;
      }

      // 2. XHR upload to Cloudinary
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadEndpoint);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const pct = Math.min(90, Math.round((e.loaded / e.total) * 90));
            setUploadProgress((prev) => setAt(prev, idx, pct));
            announce(idx, `Uploading… ${pct}% (${formatBytes(e.loaded)} of ${formatBytes(e.total)})`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let msg = `Upload rejected (${xhr.status}).`;
            try {
              const err = JSON.parse(xhr.responseText) as { error?: { message?: string } };
              if (err.error?.message) msg = `Upload rejected: ${err.error.message}`;
            } catch { /* use fallback */ }
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => reject(new Error("Upload interrupted by a network error. Please retry."));
        xhr.ontimeout = () => reject(new Error("Upload timed out. Please check your connection."));
        xhr.onabort = () => reject(new Error("Upload was aborted."));

        const form = new FormData();
        form.append("file", file);
        form.append("api_key", apiKey);
        form.append("signature", signature);
        for (const [k, v] of Object.entries(signedParams)) {
          form.append(k, String(v));
        }

        xhr.send(form);
      }).catch((err: Error) => {
        setUploadStatuses((prev) => setAt(prev, idx, "error"));
        setUploadErrors((prev) => setAt(prev, idx, err.message));
        announce(idx, `Error: ${err.message}`);
        throw err;
      });

      // 3. Server-side verification
      setUploadProgress((prev) => setAt(prev, idx, 95));
      setUploadStatuses((prev) => setAt(prev, idx, "verifying"));
      announce(idx, "Verifying document…");

      const verifyResult = await verifyGuestIdUploadAction({ draftKey, publicId });
      if (!verifyResult.ok) {
        setUploadStatuses((prev) => setAt(prev, idx, "error"));
        setUploadErrors((prev) => setAt(prev, idx, verifyResult.error));
        announce(idx, `Verification failed: ${verifyResult.error}`);
        return;
      }

      setUploadProgress((prev) => setAt(prev, idx, 100));
      setUploadStatuses((prev) => setAt(prev, idx, "done"));
      announce(idx, "Document uploaded and verified.");

      // Update entries
      const slot = guestSlots[idx];
      if (!slot) return;
      const newEntry: GuestIdEntry = {
        guestIndex: idx,
        label: slot.label,
        ageGroup: slot.ageGroup,
        fullName: names[idx] ?? "",
        idType: idTypes[idx] ?? "AADHAAR",
        mediaPublicId: verifyResult.data.publicId,
        mediaId: verifyResult.data.mediaId,
        fileName: file.name,
        bytes: verifyResult.data.bytes,
        format: verifyResult.data.format,
      };

      const newEntries = [...entries];
      newEntries[idx] = newEntry;
      onEntriesChange(newEntries);
    },
    [draftKey, entries, names, idTypes, onEntriesChange, guestSlots, announce],
  );

  const handleRemove = async (idx: number) => {
    const entry = entries[idx];
    if (!entry?.mediaPublicId) return;
    await removeGuestIdUploadAction({ draftKey, publicId: entry.mediaPublicId }).catch(() => undefined);
    const newEntries = [...entries];
    newEntries[idx] = undefined as unknown as GuestIdEntry;
    onEntriesChange(newEntries.filter(Boolean));
    setUploadStatuses((prev) => setAt(prev, idx, "idle"));
    setUploadProgress((prev) => setAt(prev, idx, 0));
    setUploadErrors((prev) => setAt(prev, idx, null));
    announce(idx, "Document removed.");
  };

  const updateName = (idx: number, val: string) => {
    const nextNames = setAt(names, idx, val);
    setNames(nextNames);
    // Update entries if already uploaded
    const entry = entries[idx];
    if (entry) {
      const newEntries = [...entries];
      newEntries[idx] = { ...entry, fullName: val };
      onEntriesChange(newEntries);
    }
  };

  const updateIdType = (idx: number, val: string) => {
    const nextTypes = setAt(idTypes, idx, val);
    setIdTypes(nextTypes);
    const entry = entries[idx];
    if (entry) {
      const newEntries = [...entries];
      newEntries[idx] = { ...entry, idType: val };
      onEntriesChange(newEntries);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-forest-700 uppercase">Step 2 of 6</p>
        <h2 className="font-heading text-2xl font-bold text-forest-900 sm:text-3xl mt-1">
          Guests and Identity Documents
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A government-issued identity document is required for every guest. For children, a school ID or birth
          certificate is accepted.
        </p>
      </div>

      {/* Guest rows */}
      <div className="space-y-6">
        {guestSlots.map((slot, idx) => {
          const status = uploadStatuses[idx] ?? "idle";
          const error = uploadErrors[idx] ?? null;
          const progress = uploadProgress[idx] ?? 0;
          const entry = entries[idx];
          const idTypeOptions = getIdTypesForAgeGroup(slot.ageGroup);
          const selectedIdType = GUEST_ID_TYPES.find((t) => t.key === idTypes[idx]);
          const slotId = `guest-${idx}`;

          return (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4"
              aria-label={slot.label}
            >
              {/* Guest header */}
              <h3 className="font-heading text-base font-semibold text-forest-900">{slot.label}</h3>

              {/* Full name */}
              <div>
                <label
                  htmlFor={`${slotId}-name`}
                  className="block text-sm font-semibold text-forest-900"
                >
                  Full Name <span aria-hidden="true" className="text-laterite-600">*</span>
                </label>
                <input
                  id={`${slotId}-name`}
                  type="text"
                  autoComplete="off"
                  required
                  value={names[idx] ?? ""}
                  onChange={(e) => updateName(idx, e.target.value)}
                  placeholder="As on identity document"
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-700"
                />
              </div>

              {/* ID type selector */}
              <div>
                <label
                  htmlFor={`${slotId}-idtype`}
                  className="block text-sm font-semibold text-forest-900"
                >
                  Identity Document Type <span aria-hidden="true" className="text-laterite-600">*</span>
                </label>
                <select
                  id={`${slotId}-idtype`}
                  value={idTypes[idx] ?? ""}
                  onChange={(e) => updateIdType(idx, e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-700"
                >
                  {idTypeOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {selectedIdType?.hint && (
                  <p className="mt-1 text-xs text-muted-foreground">{selectedIdType.hint}</p>
                )}
              </div>

              {/* Upload control */}
              <div>
                <p className="text-sm font-semibold text-forest-900">
                  Document Upload <span aria-hidden="true" className="text-laterite-600">*</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  JPG, PNG, WebP or PDF · Max 5 MB · Mobile camera capture supported
                </p>

                {/* aria-live upload progress region */}
                <p
                  id={`${slotId}-announce`}
                  aria-live="polite"
                  aria-atomic="true"
                  className="sr-only"
                >
                  {uploadAnnounce[idx] ?? ""}
                </p>

                {status === "done" && entry ? (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-green-600/20 bg-green-50/50 px-3 py-2 text-sm text-green-800">
                    <svg className="size-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="truncate">{entry.fileName} ({formatBytes(entry.bytes)})</span>
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[idx]?.click()}
                      className="ml-auto shrink-0 text-xs text-forest-700 underline hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-forest-700"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemove(idx)}
                      className="shrink-0 text-xs text-laterite-600 underline hover:text-laterite-700 focus-visible:outline-2 focus-visible:outline-laterite-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[idx]?.click()}
                    disabled={status === "uploading" || status === "verifying"}
                    aria-describedby={`${slotId}-announce`}
                    className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-forest-700"
                  >
                    {status === "uploading" ? (
                      <>
                        <span className="animate-pulse">Uploading…</span>
                        <span className="ml-auto text-xs">{progress}%</span>
                      </>
                    ) : status === "verifying" ? (
                      <span className="animate-pulse">Verifying…</span>
                    ) : (
                      <>
                        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 10l-4-4m0 0L8 10m4-4v12" />
                        </svg>
                        <span>Choose or capture document</span>
                      </>
                    )}
                  </button>
                )}

                {/* Progress bar */}
                {(status === "uploading" || status === "verifying") && (
                  <div
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Upload progress for ${slot.label}`}
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
                  >
                    <div
                      className="h-full bg-forest-700 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p role="alert" className="mt-1.5 text-xs text-laterite-600">{error}</p>
                )}

                {/* Hidden file input */}
                <input
                  ref={(el) => { fileInputRefs.current[idx] = el; }}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  capture="environment"
                  className="sr-only"
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileSelect(idx, f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Consent checkbox */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            id="id-consent"
            checked={idConsentAccepted}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-forest-700"
            required
            aria-required="true"
          />
          <span className="text-sm text-foreground leading-relaxed">
            <strong className="text-forest-900">I consent to identity document collection.</strong>{" "}
            I understand that Chawan Farms collects one identity document per guest solely for check-in
            verification, as required under Maharashtra tourism regulations. Documents are stored privately
            and accessed only by authorised staff. All documents will be permanently deleted{" "}
            <strong>{ID_RETENTION_DAYS_AFTER_CHECKOUT} days</strong> after checkout (or within 7 days of
            cancellation). No document numbers or extracted text are stored. For more information, see our{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-forest-700 underline hover:text-forest-900">
              Privacy Policy
            </a>
            .
          </span>
        </label>
      </div>
    </div>
  );
}

