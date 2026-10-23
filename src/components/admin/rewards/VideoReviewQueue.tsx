"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  approveVideoAction, featureVideoAction, getVideoReviewDetailAction, getVideoReviewQueueAction,
  previewVideoAction, rejectVideoAction, removeVideoAction, unfeatureVideoAction,
} from "@/server/actions/video-review";
import type { ReviewQueueRow } from "@/server/services/videoReview";

type QueueData = { rows: ReviewQueueRow[]; total: number; page: number; pageSize: number; pageCount: number };
type Limits = { formats: readonly string[]; maxBytes: number; maxDurationSeconds: number | null };
type Detail = {
  submission: ReviewQueueRow & { description: string | null; consentPublish: boolean; contentHash: string | null };
  duplicateMatches: Array<{ id: string; status: string; createdAt: string }>;
  customerHistory: Array<{ id: string; status: string; createdAt: string; pointsAwarded: number | null }>;
  bookings: Array<{ reference: string; status: string; checkIn: string; checkOut: string }>;
};

function formatBytes(value: number) {
  return `${Math.round(value / 1_000_000)} MB`;
}

function statusClass(status: string) {
  return status === "GREEN" ? "bg-emerald-100 text-emerald-900" : status === "AMBER" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900";
}

export function VideoReviewQueue({ initialData, limits }: { initialData: QueueData; limits: Limits }) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState("PENDING");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selected, setSelected] = useState<ReviewQueueRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | "remove" | null>(null);
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [reversePoints, setReversePoints] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const detailRef = useRef<HTMLDivElement>(null);

  const refresh = (page = data.page) => startTransition(async () => {
    const result = await getVideoReviewQueueAction({ page, pageSize: data.pageSize, status, duplicatesOnly, customerSearch: customerSearch || undefined });
    if (result.ok) setData(result.data);
    else setMessage(result.error.message);
  });

  const open = (row: ReviewQueueRow) => {
    setSelected(row);
    setDetail(null);
    setPreviewUrl(null);
    setMessage("");
    startTransition(async () => {
      const [info, preview] = await Promise.all([getVideoReviewDetailAction(row.id), previewVideoAction({ submissionId: row.id })]);
      if (info.ok) setDetail(info.data); else setMessage(info.error.message);
      if (preview.ok) setPreviewUrl(preview.data.url);
      else if (row.status !== "UPLOADING") setMessage(preview.error.message);
      detailRef.current?.focus();
    });
  };

  useEffect(() => {
    if (selected) detailRef.current?.focus();
  }, [selected]);

  const submitDecision = () => {
    if (!selected) return;
    const idempotencyKey = `${decision}:${selected.id}:${crypto.randomUUID()}`;
    startTransition(async () => {
      const input = decision === "approve"
        ? { submissionId: selected.id, idempotencyKey, override, overrideNote: overrideNote || undefined, duplicateAcknowledged }
        : decision === "reject"
          ? { submissionId: selected.id, idempotencyKey, reason }
          : { submissionId: selected.id, idempotencyKey, reason, reversePoints, reversalReason: reversalReason || undefined };
      const result = decision === "approve" ? await approveVideoAction(input) : decision === "reject" ? await rejectVideoAction(input) : await removeVideoAction(input);
      setDecision(null);
      if (result.ok) {
        const removalData = "reversalRefused" in result.data && "cloudinaryCleanupPending" in result.data
          ? result.data as { reversalRefused: string | null; cloudinaryCleanupPending: boolean }
          : null;
        const removalNote = decision === "remove" && removalData?.reversalRefused ? ` Removal completed, but the points reversal was refused: ${removalData.reversalRefused}` : "";
        const cleanupNote = decision === "remove" && removalData?.cloudinaryCleanupPending ? " Cloudinary cleanup needs a retry." : "";
        setMessage(decision === "approve" ? "Video approved and points awarded." : decision === "reject" ? "Video rejected; the reason will be shown to the customer." : `Video removed.${removalNote}${cleanupNote}`);
        setSelected(null);
        setDetail(null);
        refresh(1);
      } else setMessage(result.error.message);
    });
  };

  const feature = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await featureVideoAction({ submissionId: selected.id, idempotencyKey: `feature:${selected.id}:${crypto.randomUUID()}` });
      setMessage(result.ok ? "A draft GalleryItem and public copy were created." : result.error.message);
      if (result.ok) refresh();
    });
  };

  const unfeature = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await unfeatureVideoAction({ submissionId: selected.id, idempotencyKey: `unfeature:${selected.id}:${crypto.randomUUID()}` });
      setMessage(result.ok ? "The public copy was deleted and the gallery item archived." : result.error.message);
      if (result.ok) refresh();
    });
  };

  return (
    <section className="space-y-4" aria-label="Video review queue">
      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[auto_auto_1fr_auto] md:items-end">
          <label className="grid gap-1 text-sm">Status<select className="min-h-11 rounded-md border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="PENDING">Pending</option><option value="ALL">All</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="REMOVED">Removed</option></select></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={duplicatesOnly} onChange={(event) => setDuplicatesOnly(event.target.checked)} /> Duplicates only</label>
          <label className="grid gap-1 text-sm">Customer search<input className="min-h-11 rounded-md border bg-background px-3" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Name or email" /></label>
          <Button type="button" onClick={() => refresh(1)} disabled={isPending}>Apply filters</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Accepted customer video formats: {limits.formats.join(", ")}; maximum {formatBytes(limits.maxBytes)}; maximum duration {limits.maxDurationSeconds ?? "—"} seconds.</p>
      </div>

      <p className="min-h-6 text-sm" aria-live="polite">{isPending ? "Loading…" : message}</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3">Submitted</th><th className="p-3">Customer</th><th className="p-3">Video</th><th className="p-3">Status</th><th className="p-3">SLA</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{data.rows.map((row) => <tr key={row.id} className="border-t hover:bg-muted/30">
            <td className="p-3">{new Date(row.submittedAt).toLocaleString()}</td>
            <td className="p-3"><button className="text-left underline focus-visible:outline-2" onClick={() => open(row)}>{row.customer.name || "Customer"}<br /><span className="text-xs text-muted-foreground">{row.customer.maskedEmail}</span></button></td>
            <td className="p-3">{row.title || "Untitled"}{row.duplicate ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs">duplicate</span> : null}</td>
            <td className="p-3">{row.status}</td>
            <td className="p-3"><span className={`rounded px-2 py-1 text-xs ${statusClass(row.sla)}`}>{row.sla}</span></td>
            <td className="p-3"><Button type="button" variant="outline" size="sm" onClick={() => open(row)}>Review</Button></td>
          </tr>)}</tbody>
        </table>
        {data.rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No videos match these filters.</p> : null}
      </div>
      <div className="flex items-center justify-between text-sm"><span>Page {data.page} of {Math.max(1, data.pageCount)} · {data.total} submissions</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={data.page <= 1 || isPending} onClick={() => refresh(data.page - 1)}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={data.page >= data.pageCount || isPending} onClick={() => refresh(data.page + 1)}>Next</Button></div></div>

      {selected ? <aside ref={detailRef} tabIndex={-1} className="rounded-xl border bg-card p-4 outline-none" aria-label="Video review details">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-lg">{selected.title || "Untitled submission"}</h2><p className="text-sm text-muted-foreground">{selected.customer.name || "Customer"} · {selected.customer.maskedEmail}</p></div><span className={`rounded px-2 py-1 text-xs ${statusClass(selected.sla)}`}>{selected.sla} SLA</span></div>
        {previewUrl ? <video className="mt-4 max-h-[420px] w-full rounded-lg bg-black" controls preload="metadata" src={previewUrl}>Your browser cannot play this video.</video> : <p className="mt-4 text-sm text-muted-foreground">Preview unavailable or still loading.</p>}
        {detail ? <div className="mt-4 grid gap-4 lg:grid-cols-3"><div><h3 className="font-medium">Submission</h3><dl className="mt-2 space-y-1 text-sm"><div><dt className="inline font-medium">Visit date: </dt><dd className="inline">{detail.submission.visitDate || "Not provided"}</dd></div><div><dt className="inline font-medium">Description: </dt><dd className="inline">{detail.submission.description || "Not provided"}</dd></div><div><dt className="inline font-medium">Publish consent: </dt><dd className="inline">{detail.submission.consentPublish ? "Yes" : "No"}</dd></div></dl></div><div><h3 className="font-medium">Duplicate and history</h3><p className="mt-2 text-sm">Matching hashes: {detail.duplicateMatches.length}</p><p className="text-sm">Customer submissions: {detail.customerHistory.length}</p><ul className="mt-1 text-xs text-muted-foreground">{detail.customerHistory.slice(0, 6).map((item) => <li key={item.id}>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</li>)}</ul></div><div><h3 className="font-medium">Visit verification</h3><p className="mt-2 text-sm">Bookings within ±3 days: {detail.bookings.length}</p><ul className="mt-1 text-xs text-muted-foreground">{detail.bookings.map((booking) => <li key={booking.reference}>{booking.reference} · {booking.status} · {booking.checkIn}</li>)}</ul></div></div> : null}
        <div className="mt-5 flex flex-wrap gap-2"><Button type="button" onClick={() => setDecision("approve")} disabled={selected.status !== "PENDING"}>Approve</Button><Button type="button" variant="outline" onClick={() => setDecision("reject")} disabled={selected.status !== "PENDING"}>Reject</Button><Button type="button" variant="destructive" onClick={() => setDecision("remove")} disabled={selected.status === "REMOVED"}>Remove</Button>{selected.status === "APPROVED" && detail?.submission.consentPublish ? <><Button type="button" variant="secondary" onClick={feature}>Feature draft</Button><Button type="button" variant="outline" onClick={unfeature}>Unfeature</Button></> : null}<Button type="button" variant="ghost" onClick={() => setSelected(null)}>Close</Button></div>
      </aside> : null}

      <Dialog open={decision !== null} onOpenChange={(open) => { if (!open) setDecision(null); }}><DialogContent><DialogHeader><DialogTitle>{decision === "approve" ? "Approve video" : decision === "reject" ? "Reject video" : "Remove video"}</DialogTitle><DialogDescription>{decision === "reject" ? "This reason is shown to the customer." : decision === "remove" ? "This permanently removes the submission and its Cloudinary assets." : "Confirm the reward decision."}</DialogDescription></DialogHeader>{decision === "approve" ? <div className="space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={duplicateAcknowledged} onChange={(event) => setDuplicateAcknowledged(event.target.checked)} /> I acknowledge any flagged duplicate.</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={override} onChange={(event) => setOverride(event.target.checked)} /> Owner/Super Admin duplicate override</label>{override ? <label className="grid gap-1 text-sm">Override note<textarea className="rounded-md border p-2" value={overrideNote} onChange={(event) => setOverrideNote(event.target.value)} /></label> : null}</div> : <div className="space-y-3"><label className="grid gap-1 text-sm">Reason{decision === "reject" ? " (shown to the customer)" : ""}<textarea className="rounded-md border p-2" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2_000} required /></label>{decision === "remove" ? <><label className="flex gap-2 text-sm"><input type="checkbox" checked={reversePoints} onChange={(event) => setReversePoints(event.target.checked)} /> Attempt points reversal</label>{reversePoints ? <label className="grid gap-1 text-sm">Reversal reason<textarea className="rounded-md border p-2" value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} required /></label> : null}</> : null}</div>}<DialogFooter><Button type="button" variant="outline" onClick={() => setDecision(null)}>Cancel</Button><Button type="button" onClick={submitDecision} disabled={isPending || (decision !== "approve" && !reason.trim())}>Confirm</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
