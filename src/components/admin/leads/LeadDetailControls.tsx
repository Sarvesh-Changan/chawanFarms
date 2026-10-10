"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLeadNoteAction, updateLeadAssignmentAction, updateLeadFollowUpAction, updateLeadStatusAction } from "@/server/actions/leads-crm";

type LeadEventRow = { id: string; type: string; path: string | null; meta: unknown; createdAt: Date };
type NoteRow = { id: string; body: string; authorId: string; authorName?: string; createdAt: Date };
type EnquiryRow = { id: string; reference: string; type: string; message: string | null; pagePath: string | null; createdAt: Date };

export function LeadDetailControls({ leadId, actorId, status, closeReason, followUpAt, assignedToId, staff, notes, events, enquiries, canWrite, canAssign, canEdit }: {
  leadId: string; actorId: string; status: string; closeReason: string | null; followUpAt: Date | null; assignedToId: string | null;
  staff: Array<{ id: string; name: string }>; notes: NoteRow[]; events: LeadEventRow[]; enquiries: EnquiryRow[];
  canWrite: boolean; canAssign: boolean; canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState(status);
  const [nextReason, setNextReason] = useState(closeReason ?? "");
  const [reopenNote, setReopenNote] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [nextAssignee, setNextAssignee] = useState(assignedToId ?? "");
  const followUpDate = followUpAt?.toISOString().slice(0, 10) ?? "";

  function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? success : result.error?.message ?? "The update failed.");
      if (result.ok) router.refresh();
    });
  }

  const canChangeAssignment = canEdit && (canAssign || !assignedToId || assignedToId === actorId);
  return <div className="space-y-6">
    {message ? <p role="status" className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{message}</p> : null}
    {canWrite && canEdit ? <section className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 lg:grid-cols-2">
      <form onSubmit={(event) => { event.preventDefault(); run(() => updateLeadStatusAction({ leadId, status: nextStatus, ...(nextStatus === "CLOSED" ? { closeReason: nextReason } : {}), ...(reopenNote.trim() ? { note: reopenNote.trim() } : {}) }), "Lead status updated."); }} className="grid gap-3">
        <h2 className="font-semibold">Pipeline status</h2>
        <label className="grid gap-1 text-xs">Status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">{["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {nextStatus === "CLOSED" ? <label className="grid gap-1 text-xs">Close reason<select value={nextReason} onChange={(event) => setNextReason(event.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">Choose a reason</option>{["LOST", "DUPLICATE", "SPAM", "NOT_INTERESTED", "NO_RESPONSE"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label> : null}
        {status === "CLOSED" && nextStatus === "CONTACTED" ? <label className="grid gap-1 text-xs">Reopen note (required)<Input maxLength={2_000} value={reopenNote} onChange={(event) => setReopenNote(event.target.value)} /></label> : null}
        <Button type="submit" disabled={pending || nextStatus === status || (nextStatus === "CLOSED" && !nextReason) || (status === "CLOSED" && nextStatus === "CONTACTED" && !reopenNote.trim())}>Update status</Button>
      </form>
      <form onSubmit={(event) => { event.preventDefault(); run(() => updateLeadFollowUpAction({ leadId, followUpAt: (event.currentTarget.elements.namedItem("followUpAt") as HTMLInputElement).value }), "Follow-up date updated."); }} className="grid content-start gap-3">
        <h2 className="font-semibold">Follow-up</h2><label className="grid gap-1 text-xs">Due date<Input type="date" name="followUpAt" defaultValue={followUpDate} /></label><Button type="submit" variant="outline" disabled={pending}>Save follow-up</Button>
      </form>
    </section> : null}
    {canChangeAssignment ? <section className="rounded-xl border border-border/70 bg-card p-4"><form onSubmit={(event) => { event.preventDefault(); run(() => updateLeadAssignmentAction({ leadId, assignedToId: nextAssignee || null }), "Lead assignment updated."); }} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="grid flex-1 gap-1 text-xs">Assigned staff<select value={nextAssignee} onChange={(event) => setNextAssignee(event.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">{canAssign ? <option value="">Unassigned</option> : null}{(canAssign ? staff : staff.filter(({ id }) => id === actorId)).map((member) => <option key={member.id} value={member.id}>{member.name}{member.id === actorId ? " (you)" : ""}</option>)}</select></label><Button type="submit" variant="outline" disabled={pending || nextAssignee === (assignedToId ?? "")}>Save assignment</Button></form></section> : null}
    {canWrite && canEdit ? <section className="rounded-xl border border-border/70 bg-card p-4"><form onSubmit={(event) => { event.preventDefault(); run(() => addLeadNoteAction({ leadId, body: noteBody }), "Internal note added."); setNoteBody(""); }} className="grid gap-3"><h2 className="font-semibold">Internal note</h2><label className="grid gap-1 text-xs">Note<textarea className="min-h-24 rounded-lg border border-input bg-background p-3 text-sm" maxLength={4_000} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} /></label><Button type="submit" disabled={pending || !noteBody.trim()}>Add note</Button></form></section> : null}
    {notes.length ? <section className="rounded-xl border border-border/70 bg-card p-4"><h2 className="mb-3 font-semibold">Internal notes</h2><ul className="space-y-3">{notes.map((note) => <li key={note.id} className="border-l-2 border-turmeric-500 pl-3"><p className="whitespace-pre-wrap text-sm">{note.body}</p><p className="mt-1 text-xs text-muted-foreground">{note.authorName ?? "Staff"} · {note.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></li>)}</ul></section> : null}
    <section className="rounded-xl border border-border/70 bg-card p-4"><h2 className="mb-3 font-semibold">Timeline</h2><ol className="space-y-4 border-l border-border pl-4">
      {[...events.map((event) => ({ id: event.id, kind: "event" as const, date: event.createdAt, value: event })), ...enquiries.map((enquiry) => ({ id: enquiry.id, kind: "enquiry" as const, date: enquiry.createdAt, value: enquiry }))].sort((a, b) => b.date.getTime() - a.date.getTime()).map((item) => <li key={`${item.kind}-${item.id}`} className="relative"><span className="absolute -left-[1.32rem] top-1 size-2 rounded-full bg-forest-700" />{item.kind === "event" ? <><p className="text-sm font-medium">{item.value.type.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{item.value.path ?? ""} · {item.date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p><EventMeta meta={item.value.meta} /></> : <><p className="text-sm font-medium">Enquiry {item.value.reference} · {item.value.type.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{item.value.message ?? item.value.pagePath ?? ""} · {item.date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></>}</li>)}
      {!events.length && !enquiries.length ? <li className="text-sm text-muted-foreground">No lead activity yet.</li> : null}
    </ol></section>
  </div>;
}

function EventMeta({ meta }: { meta: unknown }) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  const text = typeof record.from === "string" && typeof record.to === "string" ? `${record.from} → ${record.to}` : typeof record.enquiryReference === "string" ? record.enquiryReference : "";
  return text ? <p className="text-xs text-muted-foreground">{text}</p> : null;
}
