"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelAccountDeletionAction, markAllNotificationsReadAction, markNotificationReadAction, redeemPointsAction, removeFavouriteAction, requestAccountDeletionAction, updateProfileAction, withdrawVideoAction } from "@/server/actions/account";

function message(result: { ok: boolean; error?: { message: string } }): string | null {
  return result.ok ? null : result.error?.message ?? "Something went wrong.";
}

export function ProfileForm({ initial }: { initial: { name: string; phone: string | null; city: string | null; marketingConsent: boolean } }) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [marketingConsent, setMarketingConsent] = useState(initial.marketingConsent);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); setStatus(null); startTransition(async () => { const result = await updateProfileAction({ name, phone, city, marketingConsent }); setStatus(message(result) ?? "Profile saved."); }); }}>
    <label className="grid gap-2 text-sm font-medium">Name<input className="min-h-11 rounded-lg border border-input bg-transparent px-3" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
    <label className="grid gap-2 text-sm font-medium">Phone<input className="min-h-11 rounded-lg border border-input bg-transparent px-3" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} placeholder="+91…" inputMode="tel" /></label>
    <label className="grid gap-2 text-sm font-medium">City<input className="min-h-11 rounded-lg border border-input bg-transparent px-3" value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} /></label>
    <label className="flex gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-forest-700" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} /><span>I agree to receive marketing communications. This choice is recorded with the consent version and request metadata.</span></label>
    {status ? <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p> : null}
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
  </form>;
}

export function RedeemButton({ tierId, disabled }: { tierId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  return <div className="grid gap-2"><Button type="button" size="sm" disabled={disabled || pending} onClick={() => { setStatus(null); startTransition(async () => { const result = await redeemPointsAction({ tierId, idempotencyKey: crypto.randomUUID() }); setStatus(message(result) ?? "Coupon issued. Open Coupons to view it."); }); }}>{pending ? "Redeeming…" : "Redeem points"}</Button>{status ? <p role="status" className="text-xs text-muted-foreground">{status}</p> : null}</div>;
}

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return <Button type="button" variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(code).then(() => setCopied(true)); }}>{copied ? "Copied" : "Copy code"}</Button>;
}

export function WithdrawVideoButton({ submissionId }: { submissionId: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  return <div className="grid gap-2"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await withdrawVideoAction({ submissionId }); setStatus(message(result) ?? "Video withdrawn."); })}>{pending ? "Withdrawing…" : "Withdraw"}</Button>{status ? <p role="status" className="text-xs text-muted-foreground">{status}</p> : null}</div>;
}

export function RemoveFavouriteButton({ entityType, entityId }: { entityType: "package" | "experience" | "activity"; entityId: string }) {
  const [pending, startTransition] = useTransition();
  return <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { await removeFavouriteAction({ entityType, entityId }); })}>{pending ? "Removing…" : "Remove"}</Button>;
}

export function NotificationButtons({ unreadId }: { unreadId?: string }) {
  const [pending, startTransition] = useTransition();
  if (unreadId) return <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { await markNotificationReadAction({ notificationId: unreadId }); })}>{pending ? "Saving…" : "Mark read"}</Button>;
  return <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => { await markAllNotificationsReadAction(); })}>{pending ? "Saving…" : "Mark all read"}</Button>;
}

export function PrivacyExportButton() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function exportData() {
    setPending(true); setStatus(null);
    try {
      const response = await fetch("/api/account/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) { const body = (await response.json()) as { error?: string }; throw new Error(body.error ?? "Export failed."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "chawan-farms-account-export.json"; link.click(); URL.revokeObjectURL(url); setStatus("Your export is ready.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Export failed."); } finally { setPending(false); }
  }
  return <div className="grid gap-2"><Button type="button" variant="outline" onClick={() => void exportData()} disabled={pending}>{pending ? "Preparing export…" : "Export my data"}</Button>{status ? <p role="status" className="text-xs text-muted-foreground">{status}</p> : null}</div>;
}

export function DeletionRequestForm({ pendingRequest }: { pendingRequest: { id: string; requestedAt: Date; reasonText: string | null } | null }) {
  const [reasonText, setReasonText] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (pendingRequest) return <div className="grid gap-3"><p className="text-sm">A deletion request is pending review.</p><Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await cancelAccountDeletionAction({ requestId: pendingRequest.id }); setStatus(message(result) ?? "Request cancelled."); })}>{pending ? "Cancelling…" : "Cancel request"}</Button>{status ? <p role="status" className="text-xs text-muted-foreground">{status}</p> : null}</div>;
  return <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); setStatus(null); startTransition(async () => { const result = await requestAccountDeletionAction({ reasonText, password: password || undefined }); setStatus(message(result) ?? "Deletion request submitted for review."); }); }}>
    <label className="grid gap-2 text-sm font-medium">Reason (optional)<Textarea value={reasonText} onChange={(event) => setReasonText(event.target.value)} maxLength={1000} /></label>
    <label className="grid gap-2 text-sm font-medium">Password re-entry (only needed if your session is not fresh)<input className="min-h-11 rounded-lg border border-input bg-transparent px-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} autoComplete="current-password" /></label>
    {status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}
    <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Submitting…" : "Request account deletion"}</Button>
  </form>;
}
