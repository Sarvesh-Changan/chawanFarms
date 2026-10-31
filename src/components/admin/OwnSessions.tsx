"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { formatSessionDate, getRelativeTime, getSessionDeviceDescription, getSessionIpLabel } from "@/lib/security/sessions";
import { revokeAllOtherSessionsAction, revokeOwnSessionAction } from "@/server/actions/admin-security";

type SessionRow = {
  id: string;
  isCurrent: boolean;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

export function OwnSessions({ sessions, isDevelopment }: { sessions: SessionRow[]; isDevelopment: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [message, setMessage] = useState("");

  async function revoke(sessionId: string) {
    setPendingId(sessionId);
    try {
      const result = await revokeOwnSessionAction({ sessionId });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      if (result.data.current) {
        router.replace("/login");
        router.refresh();
        return;
      }
      setMessage("Session revoked.");
      router.refresh();
    } finally {
      setPendingId("");
    }
  }

  async function revokeOthers() {
    setPendingId("all");
    try {
      const result = await revokeAllOtherSessionsAction();
      setMessage(result.ok ? `${result.data.revoked} other session${result.data.revoked === 1 ? "" : "s"} revoked.` : result.error.message);
      if (result.ok) router.refresh();
    } finally {
      setPendingId("");
    }
  }

  return (
    <section className="space-y-3" aria-label="Signed-in sessions">
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      {sessions.length ? <div className="flex justify-end">
        <ConfirmDialog
          trigger={<Button size="sm" variant="outline" disabled={Boolean(pendingId)}>Revoke all other sessions</Button>}
          title="Revoke all other sessions?"
          description="You will stay signed in on this device. All other devices will be signed out."
          confirmLabel="Revoke other sessions"
          destructive
          onConfirm={revokeOthers}
        />
      </div> : null}
      {sessions.length ? sessions.map((session) => {
        const startedAt = formatSessionDate(session.createdAt);
        const expiresAt = formatSessionDate(session.expiresAt);
        const device = getSessionDeviceDescription(session.userAgent);
        const ip = getSessionIpLabel(session.ipAddress, isDevelopment);
        return (
          <article key={session.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{session.isCurrent ? "This device (current)" : "Other device"}</p>
              <p className="text-sm">{device}</p>
              <p className="text-xs text-muted-foreground">IP: {ip}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <time dateTime={session.createdAt.toISOString()} title={startedAt}>Started {getRelativeTime(session.createdAt)}</time>
                {" · "}
                <time dateTime={session.expiresAt.toISOString()} title={expiresAt}>Expires {getRelativeTime(session.expiresAt)}</time>
              </p>
            </div>
            <ConfirmDialog
              trigger={<Button size="sm" variant="outline" disabled={Boolean(pendingId)}>{session.isCurrent ? "Revoke this session" : "Revoke"}</Button>}
              title="Revoke this session?"
              description={session.isCurrent ? "You will be signed out now." : "The selected device will be signed out."}
              confirmLabel={session.isCurrent ? "Revoke and sign out" : "Revoke session"}
              destructive
              onConfirm={() => revoke(session.id)}
            />
          </article>
        );
      }) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No active sessions found.</p>}
    </section>
  );
}
