"use client";

import { Check, Copy, KeyRound, RefreshCw, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  acceptStaffInviteAction,
  changeStaffRolesAction,
  createStaffAccountAction,
  deleteStaffAccountAction,
  disableStaffAction,
  enableStaffAction,
  inviteStaffAction,
  resetStaffPasswordAction,
  revokeStaffInviteAction,
  revokeStaffSessionsAction,
  startTwoFactorSetupAction,
  updateStaffNameAction,
  verifyTwoFactorSetupAction,
} from "@/server/actions/admin-security";

type RoleOption = { id: string; name: string };
export type StaffRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  twoFactorEnabled: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: Date | string | null;
  roleIds: string[];
  staffRoles: Array<{ role: { id: string; name: string } }>;
};
type InviteRow = { id: string; email: string; expiresAt: Date; createdAt: Date };

function ActionMessage({ message, success }: { message: string; success: boolean }) {
  return message ? (
    <p role="status" className={success ? "text-sm text-forest-700 font-medium" : "text-sm text-destructive font-medium"}>
      {message}
    </p>
  ) : null;
}

function generateClientPassword(length = 16): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";
  const all = uppercase + lowercase + numbers + symbols;

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  const chars = [
    uppercase[array[0]! % uppercase.length]!,
    lowercase[array[1]! % lowercase.length]!,
    numbers[array[2]! % numbers.length]!,
    symbols[array[3]! % symbols.length]!,
  ];

  for (let i = 4; i < length; i++) {
    chars.push(all[array[i]! % all.length]!);
  }

  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = array[i]! % (i + 1);
    const temp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = temp;
  }

  return chars.join("");
}

export function CreateStaffAccountDialog({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [freshPassword, setFreshPassword] = useState("");
  const [freshTotp, setFreshTotp] = useState("");

  const [createdPasswordModal, setCreatedPasswordModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedRoleName = roles.find((r) => r.id === roleId)?.name ?? "";
  const isSuperAdminRole = selectedRoleName === "Super Admin";

  const handleGeneratePassword = () => {
    const generated = generateClientPassword(16);
    setPassword(generated);
  };

  const handleCopyPassword = async () => {
    if (!createdPasswordModal) return;
    await navigator.clipboard.writeText(createdPasswordModal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (!password || password.length < 12) return setError("Password must be at least 12 characters.");
    if (isSuperAdminRole && !freshPassword) {
      return setError("Your current password is required to create a Super Admin account.");
    }

    const currentPwd = password;

    startTransition(async () => {
      const result = await createStaffAccountAction({
        name: name.trim(),
        email: email.trim(),
        roleId,
        initialPassword: currentPwd,
        freshSessionPassword: isSuperAdminRole ? freshPassword : undefined,
        freshSessionTotpCode: isSuperAdminRole && freshTotp ? freshTotp.trim() : undefined,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setCreatedPasswordModal(currentPwd);
      setName("");
      setEmail("");
      setPassword("");
      setFreshPassword("");
      setFreshTotp("");
      router.refresh();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-forest-900 text-cream-50 hover:bg-forest-800">
            <UserPlus className="mr-2 size-4" />
            Create Admin Account
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Create Admin Account</DialogTitle>
            <DialogDescription>
              Create a new administrator account directly. The user will be required to change their
              password and enrol in two-factor authentication upon first login.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="create-staff-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full Name
              </label>
              <Input
                id="create-staff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-staff-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Address
              </label>
              <Input
                id="create-staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@chawanfarms.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-staff-role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned Role
              </label>
              <select
                id="create-staff-role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="create-staff-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Initial Temporary Password
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={handleGeneratePassword} className="h-6 text-xs text-forest-700">
                  Generate
                </Button>
              </div>
              <Input
                id="create-staff-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown ONCE upon creation. Never sent by email or stored in plain text.
              </p>
            </div>

            {isSuperAdminRole && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="size-4 shrink-0 text-amber-600" />
                  Sensitive Action: Creating Super Admin
                </div>
                <p className="text-xs text-muted-foreground">
                  Confirm your own credentials to provision a Super Admin account.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="create-staff-fresh-pw" className="text-xs font-medium">
                    Your Current Password
                  </label>
                  <Input
                    id="create-staff-fresh-pw"
                    type="password"
                    required
                    value={freshPassword}
                    onChange={(e) => setFreshPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-staff-fresh-totp" className="text-xs font-medium">
                    Your 6-Digit TOTP Code (if 2FA enrolled)
                  </label>
                  <Input
                    id="create-staff-fresh-totp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={freshTotp}
                    onChange={(e) => setFreshTotp(e.target.value)}
                    placeholder="000000"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="bg-forest-900 text-cream-50 hover:bg-forest-800">
                {pending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Show Once Temporary Password Modal */}
      <Dialog open={Boolean(createdPasswordModal)} onOpenChange={(val) => { if (!val) setCreatedPasswordModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-forest-900">
              Account Created Successfully
            </DialogTitle>
            <DialogDescription>
              Copy the temporary password now. It will <strong>NOT</strong> be displayed again and was
              <strong> NOT</strong> emailed to the user for security.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border bg-muted p-3">
              <code className="font-mono text-sm font-semibold tracking-wider text-foreground">
                {createdPasswordModal}
              </code>
              <Button type="button" size="sm" variant="secondary" onClick={handleCopyPassword} className="h-8">
                {copied ? <Check className="mr-1 size-3.5 text-forest-700" /> : <Copy className="mr-1 size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A notice email has been dispatched with login instructions. The user will be required to
              change this password upon their first sign-in.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="w-full bg-forest-900 text-cream-50 hover:bg-forest-800"
              onClick={() => setCreatedPasswordModal(null)}
            >
              Done &amp; Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditStaffNameDialog({ person }: { person: StaffRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(person.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name cannot be empty.");

    startTransition(async () => {
      const res = await updateStaffNameAction({ targetUserId: person.id, name: name.trim() });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit Name
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Edit Staff Name</DialogTitle>
          <DialogDescription>Update the display name for {person.email}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="space-y-1.5">
            <label htmlFor={`edit-name-${person.id}`} className="text-xs font-semibold uppercase text-muted-foreground">
              Name
            </label>
            <Input
              id={`edit-name-${person.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResetStaffPasswordDialog({ person }: { person: StaffRow }) {
  const [open, setOpen] = useState(false);
  const [freshPassword, setFreshPassword] = useState("");
  const [freshTotp, setFreshTotp] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!freshPassword) return setError("Your current password is required.");

    startTransition(async () => {
      const res = await resetStaffPasswordAction({
        targetUserId: person.id,
        freshSessionPassword: freshPassword,
        freshSessionTotpCode: freshTotp ? freshTotp.trim() : undefined,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setTempPassword(res.data.temporaryPassword);
      setFreshPassword("");
      setFreshTotp("");
    });
  };

  const handleCopy = async () => {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setTempPassword(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="mr-1.5 size-3.5" />
          Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Reset Password for {person.name}</DialogTitle>
          <DialogDescription>
            Generate a temporary password and revoke all active sessions for {person.email}.
            The user must change their password on next login.
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-forest-200 bg-forest-50 p-3 text-sm text-forest-900">
              Password reset completed. Share this temporary password securely with the user:
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted p-3">
              <code className="font-mono text-sm font-semibold tracking-wider text-foreground">
                {tempPassword}
              </code>
              <Button type="button" size="sm" variant="secondary" onClick={handleCopy} className="h-8">
                {copied ? <Check className="mr-1 size-3.5 text-forest-700" /> : <Copy className="mr-1 size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Confirm your own credentials to perform this sensitive operation.
            </p>
            <div className="space-y-1.5">
              <label htmlFor={`reset-fresh-pw-${person.id}`} className="text-xs font-medium">
                Your Current Password
              </label>
              <Input
                id={`reset-fresh-pw-${person.id}`}
                type="password"
                required
                value={freshPassword}
                onChange={(e) => setFreshPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`reset-fresh-totp-${person.id}`} className="text-xs font-medium">
                Your 6-Digit TOTP Code (if 2FA enrolled)
              </label>
              <Input
                id={`reset-fresh-totp-${person.id}`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={freshTotp}
                onChange={(e) => setFreshTotp(e.target.value)}
                placeholder="000000"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="bg-forest-900 text-cream-50 hover:bg-forest-800">
                {pending ? "Resetting..." : "Confirm & Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteStaffAccountDialog({ person, actorId }: { person: StaffRow; actorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [freshPassword, setFreshPassword] = useState("");
  const [freshTotp, setFreshTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isSelf = actorId === person.id;

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (confirmEmail.trim().toLowerCase() !== person.email.toLowerCase()) {
      return setError(`Please type the exact email: ${person.email}`);
    }
    if (!freshPassword) {
      return setError("Your current password is required.");
    }

    startTransition(async () => {
      const res = await deleteStaffAccountAction({
        targetUserId: person.id,
        confirmEmail: confirmEmail.trim(),
        freshSessionPassword: freshPassword,
        freshSessionTotpCode: freshTotp ? freshTotp.trim() : undefined,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  if (isSelf) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" />
            <DialogTitle className="font-heading text-lg text-destructive">
              Delete Staff Account
            </DialogTitle>
          </div>
          <DialogDescription>
            This action revokes all credentials and sessions for <strong>{person.email}</strong>. If
            references exist in logs, payments, or bookings, the row is safely anonymised to preserve
            audit integrity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor={`delete-confirm-email-${person.id}`} className="text-xs font-semibold uppercase text-muted-foreground">
              Confirm Email (type: <span className="font-mono lowercase select-all">{person.email}</span>)
            </label>
            <Input
              id={`delete-confirm-email-${person.id}`}
              type="email"
              required
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={person.email}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`delete-fresh-pw-${person.id}`} className="text-xs font-medium">
              Your Current Password
            </label>
            <Input
              id={`delete-fresh-pw-${person.id}`}
              type="password"
              required
              value={freshPassword}
              onChange={(e) => setFreshPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`delete-fresh-totp-${person.id}`} className="text-xs font-medium">
              Your 6-Digit TOTP Code (if 2FA enrolled)
            </label>
            <Input
              id={`delete-fresh-totp-${person.id}`}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={freshTotp}
              onChange={(e) => setFreshTotp(e.target.value)}
              placeholder="000000"
            />
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting..." : "Permanently Delete Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DisableStaffDialog({ person, actorId }: { person: StaffRow; actorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [freshPassword, setFreshPassword] = useState("");
  const [freshTotp, setFreshTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (actorId === person.id) return null;

  const handleDisable = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!freshPassword) return setError("Your current password is required.");

    startTransition(async () => {
      const res = await disableStaffAction({
        targetUserId: person.id,
        freshSessionPassword: freshPassword,
        freshSessionTotpCode: freshTotp ? freshTotp.trim() : undefined,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Disable
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Disable Account: {person.name}</DialogTitle>
          <DialogDescription>
            The account will be suspended and all active sessions will be revoked.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDisable} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor={`disable-fresh-pw-${person.id}`} className="text-xs font-medium">
              Your Current Password
            </label>
            <Input
              id={`disable-fresh-pw-${person.id}`}
              type="password"
              required
              value={freshPassword}
              onChange={(e) => setFreshPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`disable-fresh-totp-${person.id}`} className="text-xs font-medium">
              Your 6-Digit TOTP Code (if 2FA enrolled)
            </label>
            <Input
              id={`disable-fresh-totp-${person.id}`}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={freshTotp}
              onChange={(e) => setFreshTotp(e.target.value)}
              placeholder="000000"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Disabling..." : "Confirm & Disable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffManagement({
  staff,
  roles,
  canWrite,
  canManageRoles,
  isSuperAdmin,
  actorId,
}: {
  staff: StaffRow[];
  roles: RoleOption[];
  canWrite: boolean;
  canManageRoles: boolean;
  isSuperAdmin?: boolean;
  actorId?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Map<string, string[]>>(() => new Map(staff.map((person) => [person.id, person.roleIds])));
  const [freshRoleDialog, setFreshRoleDialog] = useState<{ userId: string; roleIds: string[] } | null>(null);
  const [freshPassword, setFreshPassword] = useState("");
  const [freshTotp, setFreshTotp] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const superAdminRoleId = roles.find((r) => r.name === "Super Admin")?.id;

  function saveRoles(userId: string) {
    const nextRoleIds = selected.get(userId) ?? [];
    const currentPerson = staff.find((p) => p.id === userId);
    const wasSuperAdmin = superAdminRoleId ? currentPerson?.roleIds.includes(superAdminRoleId) : false;
    const willBeSuperAdmin = superAdminRoleId ? nextRoleIds.includes(superAdminRoleId) : false;

    // Promoting to Super Admin requires fresh session
    if (!wasSuperAdmin && willBeSuperAdmin) {
      setFreshRoleDialog({ userId, roleIds: nextRoleIds });
      return;
    }

    startTransition(async () => {
      const result = await changeStaffRolesAction({ targetUserId: userId, roleIds: nextRoleIds });
      setMessage(result.ok ? "Staff roles updated." : result.error.message);
      if (result.ok) router.refresh();
    });
  }

  function handleConfirmPromoteSuperAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!freshRoleDialog) return;

    startTransition(async () => {
      const result = await changeStaffRolesAction({
        targetUserId: freshRoleDialog.userId,
        roleIds: freshRoleDialog.roleIds,
        freshSessionPassword: freshPassword,
        freshSessionTotpCode: freshTotp ? freshTotp.trim() : undefined,
      });

      setMessage(result.ok ? "Staff promoted to Super Admin." : result.error.message);
      if (result.ok) {
        setFreshRoleDialog(null);
        setFreshPassword("");
        setFreshTotp("");
        router.refresh();
      }
    });
  }

  function enable(userId: string) {
    startTransition(async () => {
      const result = await enableStaffAction({ targetUserId: userId });
      setMessage(result.ok ? "Staff account re-enabled." : result.error.message);
      if (result.ok) router.refresh();
    });
  }

  function revokeSessions(userId: string) {
    startTransition(async () => {
      const result = await revokeStaffSessionsAction({ targetUserId: userId });
      setMessage(result.ok ? `Revoked ${result.data.revoked} active sessions.` : result.error.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {message ? <p role="status" className="text-sm font-medium text-muted-foreground">{message}</p> : null}

      {/* Fresh Session Dialog for promoting to Super Admin */}
      <Dialog open={Boolean(freshRoleDialog)} onOpenChange={(val) => { if (!val) setFreshRoleDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Confirm Super Admin Promotion</DialogTitle>
            <DialogDescription>
              Granting the Super Admin role requires fresh authentication.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmPromoteSuperAdmin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="promote-fresh-pw" className="text-xs font-medium">
                Your Current Password
              </label>
              <Input
                id="promote-fresh-pw"
                type="password"
                required
                value={freshPassword}
                onChange={(e) => setFreshPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="promote-fresh-totp" className="text-xs font-medium">
                Your 6-Digit TOTP Code (if 2FA enrolled)
              </label>
              <Input
                id="promote-fresh-totp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={freshTotp}
                onChange={(e) => setFreshTotp(e.target.value)}
                placeholder="000000"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFreshRoleDialog(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="bg-forest-900 text-cream-50 hover:bg-forest-800">
                {pending ? "Promoting..." : "Confirm Promotion"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {staff.length ? (
        staff.map((person) => {
          const isActor = actorId === person.id;
          const isAnonymised = person.email.endsWith("@invalid.local");

          return (
            <article
              key={person.id}
              className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 lg:grid-cols-[1fr_1.4fr_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{person.name}</p>
                  {isSuperAdmin && !isAnonymised && (
                    <EditStaffNameDialog person={person} />
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{person.email}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{person.status.toLowerCase()}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    TOTP: {person.twoFactorEnabled ? "Enrolled" : "No"}
                  </span>
                  {person.mustChangePassword && (
                    <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5">
                      Must Change PW
                    </span>
                  )}
                </div>
              </div>

              {canManageRoles && isSuperAdmin && !isAnonymised && !isActor ? (
                <fieldset disabled={person.status !== "ACTIVE"} className="flex flex-wrap gap-x-4 gap-y-2 disabled:opacity-60">
                  <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Roles
                  </legend>
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-forest-700"
                        checked={(selected.get(person.id) ?? []).includes(role.id)}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Map(current);
                            const currentRoles = next.get(person.id) ?? [];
                            next.set(
                              person.id,
                              event.target.checked
                                ? [...currentRoles, role.id]
                                : currentRoles.filter((id) => id !== role.id),
                            );
                            return next;
                          })
                        }
                      />
                      {role.name}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider block mb-1">Roles</span>
                  {person.staffRoles.map((r) => r.role.name).join(", ") || "No roles assigned"}
                  {isActor && <span className="ml-2 text-xs text-muted-foreground">(You cannot change your own role)</span>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {isSuperAdmin && canManageRoles && person.status === "ACTIVE" && !isActor && !isAnonymised && (
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => saveRoles(person.id)}>
                    Save Roles
                  </Button>
                )}

                {isSuperAdmin && !isAnonymised && (
                  <ResetStaffPasswordDialog person={person} />
                )}

                {isSuperAdmin && !isAnonymised && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => revokeSessions(person.id)}
                    title="Revoke all active sessions for this admin"
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Revoke Sessions
                  </Button>
                )}

                {canWrite && person.status === "ACTIVE" && !isActor && !isAnonymised && (
                  <DisableStaffDialog person={person} actorId={actorId ?? ""} />
                )}

                {canWrite && person.status === "SUSPENDED" && !isAnonymised && !isActor && (
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => enable(person.id)}>
                    Enable
                  </Button>
                )}

                {isSuperAdmin && !isActor && !isAnonymised && (
                  <DeleteStaffAccountDialog person={person} actorId={actorId ?? ""} />
                )}
              </div>
            </article>
          );
        })
      ) : (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No staff members found.
        </p>
      )}
    </div>
  );
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
      <label className="grid gap-1 text-sm font-medium">
        Email address
        <Input name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Initial roles</legend>
        {roles.map((role) => (
          <label key={role.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={`role-${role.id}`} className="size-4 accent-forest-700" />
            {role.name}
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending || !roles.length}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
      <div className="sm:col-span-full">
        <ActionMessage message={message} success={success} />
      </div>
    </form>
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
      {invites.length ? (
        invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{invite.email}</p>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(invite.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </p>
            </div>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" disabled={pending}>
                  Revoke invite
                </Button>
              }
              title="Revoke invitation?"
              description="The invitation link will stop working immediately."
              confirmLabel="Revoke"
              destructive
              onConfirm={() => revoke(invite.id)}
            />
          </div>
        ))
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No pending invitations.
        </p>
      )}
    </div>
  );
}

export function TwoFactorSetup({ email }: { email: string }) {
  const router = useRouter();
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startTwoFactorSetupAction();
      if (!result.ok) return setMessage(result.error.message);
      setTotpURI(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
      setMessage("Scan the QR code, save recovery codes, and verify a 6-digit code.");
    });
  }

  function verify(formData: FormData) {
    startTransition(async () => {
      const code = String(formData.get("code") || "");
      const result = await verifyTwoFactorSetupAction({ code });
      setMessage(result.ok ? "Two-factor authentication is enabled." : result.error.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-xl">Set up an authenticator</h2>
        <p className="text-sm text-muted-foreground">
          Use a TOTP authenticator app for {email}. Click below to create your setup key.
        </p>
        <Button onClick={start} disabled={pending}>
          {pending ? "Preparing…" : "Generate setup QR"}
        </Button>
      </div>

      {totpURI ? (
        <div className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
          <div className="mx-auto w-fit rounded-lg bg-white p-3">
            <QRCodeSVG value={totpURI} size={192} level="M" />
          </div>
          <div>
            <h2 className="font-semibold">Recovery codes</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Save these codes somewhere secure. They are shown only during this setup.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code) => (
                <li key={code} className="rounded bg-muted p-2">
                  {code}
                </li>
              ))}
            </ul>
          </div>
          <form action={verify} className="flex flex-col gap-2 sm:flex-row">
            <label className="grid flex-1 gap-1 text-sm font-medium">
              Authenticator code
              <Input name="code" inputMode="numeric" pattern="[0-9]{6}" required />
            </label>
            <Button type="submit" className="self-end" disabled={pending}>
              {pending ? "Checking…" : "Verify and enable"}
            </Button>
          </form>
        </div>
      ) : null}

      <p role="status" className="lg:col-span-full text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
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
      const result = await acceptStaffInviteAction({
        token,
        email: typeof email === "string" && email ? email : undefined,
        name: typeof name === "string" && name ? name : undefined,
        password: typeof password === "string" && password ? password : undefined,
        turnstileToken,
      });
      setAccepted(result.ok);
      setMessage(
        result.ok
          ? result.data.verificationRequired
            ? "Account created. Verify your email, then sign in to use the staff workspace."
            : "Invitation accepted. Sign in to continue."
          : result.error.message,
      );
    });
  }

  return (
    <form action={submit} className="mx-auto grid w-full max-w-lg gap-4 rounded-xl border border-border/70 bg-card p-6">
      <div>
        <h1 className="font-heading text-3xl">Accept staff invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the invited email address. New accounts will need to verify their email before signing in.
        </p>
      </div>
      {signedInEmail ? (
        <>
          <input type="hidden" name="email" value={signedInEmail} />
          <p className="rounded-lg bg-muted p-3 text-sm">
            Accepting for <strong>{signedInEmail}</strong>
          </p>
        </>
      ) : (
        <>
          <label className="grid gap-1 text-sm font-medium">
            Email address
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Name
            <Input name="name" autoComplete="name" maxLength={120} required />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Create password
            <Input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required />
          </label>
          <p className="text-xs text-muted-foreground">
            If you already have an account, sign in with the invited email first; then reopen this link.
          </p>
          <TurnstileField onToken={updateTurnstileToken} />
        </>
      )}
      <Button type="submit" disabled={pending || accepted}>
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
      <ActionMessage message={message} success={accepted} />
    </form>
  );
}
