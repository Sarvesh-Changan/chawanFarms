"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublishStatus } from "@/generated/prisma/client";
import { changeCmsPublishStatusAction } from "@/server/actions/cms";
import type { CmsEntityType } from "@/server/services/cms/types";

const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

function utcInputValue(value: Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PublishBar({ entityType, id, status, publishAt, canPublish }: {
  entityType: CmsEntityType;
  id?: string;
  status: PublishStatus;
  publishAt?: Date | null;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<PublishStatus>(status);
  const [scheduledAt, setScheduledAt] = useState(utcInputValue(publishAt ?? null));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveStatus() {
    if (!id) return;
    startTransition(async () => {
      const publishDate = nextStatus === "SCHEDULED" && scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null;
      const result = await changeCmsPublishStatusAction({ entityType, id, status: nextStatus, publishAt: publishDate });
      setMessage(result.ok ? "Publishing status saved." : result.error.message);
      if (result.ok) router.refresh();
    });
  }

  return <section className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
    <label className="grid gap-1 text-xs font-semibold">Publication status
      <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as PublishStatus)} disabled={!canPublish || pending} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
        {STATUSES.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}
      </select>
    </label>
    {nextStatus === "SCHEDULED" ? <label className="grid gap-1 text-xs font-semibold">Publish date and time (local time)
      <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} disabled={!canPublish || pending} required />
    </label> : <p className="self-center text-xs text-muted-foreground">Draft, published and archived items are visible according to their status.</p>}
    <Button type="button" onClick={saveStatus} disabled={!id || !canPublish || pending || (nextStatus === "SCHEDULED" && !scheduledAt)}>{pending ? "Saving…" : "Save status"}</Button>
    {message ? <p role="status" className="text-xs text-muted-foreground sm:col-span-full">{message}</p> : null}
    {!canPublish ? <p className="text-xs text-muted-foreground sm:col-span-full">You can edit content, but do not have permission to change its publication status.</p> : null}
    {!id ? <p className="text-xs text-muted-foreground sm:col-span-full">Save this item before changing its publication status.</p> : null}
  </section>;
}
