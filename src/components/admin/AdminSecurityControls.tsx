"use client";

import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptStaffInviteAction, changeStaffRolesAction, disableStaffAction, inviteStaffAction, revokeOwnSessionAction, revokeStaffInviteAction, startTwoFactorSetupAction, verifyTwoFactorSetupAction } from "@/server/actions/admin-security";

type RoleOption = { id: string; name: string };
type StaffRow = { id: string; name: string; email: string; status: string; twoFactorEnabled: boolean; roleIds: string[] };
type InviteRow = { id: string; email: string; expiresAt: Date; createdAt: Date };

function ActionMessage({ message, success }: { message: string; success: boolean }) {
  return message ? <p role="status" className={success ? "text-sm text-forest-700" : "text-sm text-destructive"}>{message}</p> : null;
}

export function InviteStaffForm({ roles }: { roles: RoleOption[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  function submit(formData: FormData) {
    const roleIds = roles.filter(({ id }) => formData.get(`role-${id}`) === "on").map(({ id }) => id);
    startTransition(async () => {
      const result = await inviteStaffAction({ email: formData.get("email"), roleIds });
      setSuccess(result.ok);
      setMessage(result.ok ? "Invitation sent. The secure link expires in 72 hours." : result.error.message);
    });
  }
  return (
    <form action={submit} className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
      <label className="grid gap-1 text-sm font-medium">Email address<Input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Initial roles</legend>
        {roles.map((role) => <label key={role.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`role-${role.id}`} className="size-4 accent-forest-700" />{role.name}</label>)}
      </fieldset>
      <Button type="submit" disabled={pending || !roles.length}>{pending ? "Sending…" : "Send invite"}</Button>
      <div className="sm:col-span-full"><ActionMessage message={message} success={success} /></div>
    </form>
  );
}

export function StaffManagement({ staff, roles, canWrite, canManageRoles }: { staff: StaffRow[]; roles: RoleOption[]; canWrite: boolean; canManageRoles: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Map<string, string[]>>(() => new Map(staff.map((person) => [person.id, person.roleIds])));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function saveRoles(userId: string) {
    startTransition(async () => {
      const result = await changeStaffRolesAction({ targetUserId: userId, roleIds: selected.get(userId) ?? [] });
      setMessage(result.ok ? "Staff roles updated." : result.error.message);
      if (result.ok) router.refresh();
    });
  }
  function disable(userId: string) {
    startTransition(async () => {
      const result = await disableStaffAction({ targetUserId: userId });
      setMessage(result.ok ? "Staff account disabled and sessions revoked." : result.error.message);
      if (result.ok) router.refresh();
    });
  }
  return (
    <div className="space-y-3">
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      {staff.length ? staff.map((person) => (
        <article key={person.id} className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 lg:grid-cols-[1fr_1.4fr_auto] lg:items-center">
          <div className="min-w-0"><p className="truncate font-semibold">{person.name}</p><p className="truncate text-sm text-muted-foreground">{person.email}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-muted px-2 py-1">{person.status.toLowerCase()}</span><span className="rounded-full bg-muted px-2 py-1">2FA {person.twoFactorEnabled ? "enabled" : "not enabled"}</span></div></div>
          {canManageRoles ? <fieldset disabled={person.status !== "ACTIVE"} className="flex flex-wrap gap-x-4 gap-y-2 disabled:opacity-60">
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Roles</legend>
            {roles.map((role) => <label key={role.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-forest-700" checked={(selected.get(person.id) ?? []).includes(role.id)} onChange={(event) => setSelected((current) => { const next = new Map(current); const currentRoles = next.get(person.id) ?? []; next.set(person.id, event.target.checked ? [...currentRoles, role.id] : currentRoles.filter((id) => id !== role.id)); return next; })} />{role.name}</label>)}
          </fieldset> : <p className="text-sm text-muted-foreground">{person.roleIds.length ? "Assigned roles are visible in the table above." : "No roles assigned."}</p>}
          {canManageRoles || canWrite ? <div className="flex flex-wrap gap-2">{canManageRoles && person.status === "ACTIVE" ? <Button variant="outline" size="sm" disabled={pending} onClick={() => saveRoles(person.id)}>Save roles</Button> : null}{canWrite && person.status === "ACTIVE" ? <ConfirmDialog trigger={<Button variant="destructive" size="sm">Disable</Button>} title="Disable staff account?" description="The account will be suspended and all active sessions will be revoked." confirmLabel="Disable account" destructive onConfirm={() => disable(person.id)} /> : null}</div> : null}
        </article>
      )) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No staff members found.</p>}
    </div>
  );
}

export function PendingInvites({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function revoke(inviteId: string) {
    startTransition(async () => {
      const result = await revokeStaffInviteAction({ inviteId });
      setMessage(result.ok ? "Invitation revoked." : result.error.message);
      if (result.ok) router.refresh();
    });
  }
  return (
    <div className="space-y-2">
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      {invites.length ? invites.map((invite) => <div key={invite.id} className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{invite.email}</p><p className="text-xs text-muted-foreground">Expires {invite.expiresAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div><ConfirmDialog trigger={<Button size="sm" variant="outline" disabled={pending}>Revoke invite</Button>} title="Revoke invitation?" description="The invitation link will stop working immediately." confirmLabel="Revoke" destructive onConfirm={() => revoke(invite.id)} /></div>) : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No pending invitations.</p>}
    </div>
  );
}

export function TwoFactorSetup({ email }: { email: string }) {
  const router = useRouter();
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function start(formData: FormData) {
    startTransition(async () => {
      const result = await startTwoFactorSetupAction({ password: formData.get("password") });
      if (!result.ok) return setMessage(result.error.message);
      setTotpURI(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
      setMessage("Scan the QR code, save the recovery codes, then verify a code from your authenticator.");
    });
  }
  function verify(formData: FormData) {
    startTransition(async () => {
      const result = await verifyTwoFactorSetupAction({ code: formData.get("code") });
      setMessage(result.ok ? "Two-factor authentication is enabled." : result.error.message);
      if (result.ok) router.refresh();
    });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form action={start} className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-xl">Set up an authenticator</h2>
        <p className="text-sm text-muted-foreground">Use a TOTP authenticator app for {email}. Confirm your password to create the setup key.</p>
        <label className="grid gap-1 text-sm font-medium">Current password<Input name="password" type="password" required autoComplete="current-password" /></label>
        <Button type="submit" disabled={pending}>{pending ? "Preparing…" : "Generate setup QR"}</Button>
      </form>
      {totpURI ? <div className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <div className="mx-auto w-fit rounded-lg bg-white p-3"><QRCodeSVG value={totpURI} size={192} level="M" /></div>
        <div><h2 className="font-semibold">Recovery codes</h2><p className="mt-1 text-xs text-muted-foreground">Save these codes somewhere secure. They are shown only during this setup.</p><ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{backupCodes.map((code) => <li key={code} className="rounded bg-muted p-2">{code}</li>)}</ul></div>
        <form action={verify} className="flex flex-col gap-2 sm:flex-row"><label className="grid flex-1 gap-1 text-sm font-medium">Authenticator code<Input name="code" inputMode="numeric" pattern="[0-9]{6,8}" required /></label><Button type="submit" className="self-end" disabled={pending}>{pending ? "Checking…" : "Verify and enable"}</Button></form>
      </div> : null}
      <p role="status" className="lg:col-span-full text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function OwnSessions({ sessions, currentSessionId }: { sessions: Array<{ id: string; createdAt: Date; expiresAt: Date; ipAddress: string | null; userAgent: string | null }>; currentSessionId: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [message, setMessage] = useState("");
  function revoke(sessionId: string) {
    setPendingId(sessionId);
    void revokeOwnSessionAction({ sessionId }).then((result) => {
      setMessage(result.ok ? "Session revoked." : result.error.message);
      router.refresh();
    }).finally(() => setPendingId(""));
  }
  return <div className="space-y-3">{message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}{sessions.length ? sessions.map((session) => <article key={session.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{session.id === currentSessionId ? "This device" : "Signed-in device"}</p><p className="text-xs text-muted-foreground">{session.ipAddress ?? "IP unavailable"} · {session.userAgent?.slice(0, 120) ?? "Device details unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">Started {session.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Expires {session.expiresAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div><ConfirmDialog trigger={<Button size="sm" variant="outline" disabled={pendingId === session.id}>Revoke</Button>} title="Revoke this session?" description="The selected device will be signed out." confirmLabel="Revoke session" destructive onConfirm={() => revoke(session.id)} /></article>) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No active sessions found.</p>}</div>;
}

export function AcceptStaffInviteForm({ token, signedInEmail }: { token: string; signedInEmail?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const updateTurnstileToken = useCallback((value: string | undefined) => setTurnstileToken(value), []);
  function submit(formData: FormData) {
    startTransition(async () => {
      const email = formData.get("email");
      const name = formData.get("name");
      const password = formData.get("password");
      const result = await acceptStaffInviteAction({ token, email: typeof email === "string" && email ? email : undefined, name: typeof name === "string" && name ? name : undefined, password: typeof password === "string" && password ? password : undefined, turnstileToken });
      setAccepted(result.ok);
      setMessage(result.ok ? result.data.verificationRequired ? "Account created. Verify your email, then sign in to use the staff workspace." : "Invitation accepted. Sign in to continue." : result.error.message);
    });
  }
  return <form action={submit} className="mx-auto grid w-full max-w-lg gap-4 rounded-xl border border-border/70 bg-card p-6"><div><h1 className="font-heading text-3xl">Accept staff invitation</h1><p className="mt-2 text-sm text-muted-foreground">Use the invited email address. New accounts will need to verify their email before signing in.</p></div>{signedInEmail ? <><input type="hidden" name="email" value={signedInEmail} /><p className="rounded-lg bg-muted p-3 text-sm">Accepting for <strong>{signedInEmail}</strong></p></> : <><label className="grid gap-1 text-sm font-medium">Email address<Input name="email" type="email" autoComplete="email" required /></label><label className="grid gap-1 text-sm font-medium">Name<Input name="name" autoComplete="name" maxLength={120} required /></label><label className="grid gap-1 text-sm font-medium">Create password<Input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /></label><p className="text-xs text-muted-foreground">If you already have an account, sign in with the invited email first; then reopen this link.</p><TurnstileField onToken={updateTurnstileToken} /></>}<Button type="submit" disabled={pending || accepted}>{pending ? "Accepting…" : "Accept invitation"}</Button><ActionMessage message={message} success={accepted} /></form>;
}
