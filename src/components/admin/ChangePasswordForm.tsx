"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { forceChangePasswordAction } from "@/server/actions/admin-security";

export function ChangePasswordForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 12) {
      setErrorMessage("New password must be at least 12 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const res = await forceChangePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.ok) {
        setErrorMessage(res.error.message);
        return;
      }

      // Successful change; navigate to next destination (e.g. 2FA setup or dashboard)
      router.push(res.data.redirectTo);
      router.refresh();
    });
  };

  return (
    <Card className="mx-auto w-full max-w-md shadow-md">
      <CardHeader>
        <CardTitle className="font-heading text-2xl text-forest-900">Change Your Password</CardTitle>
        <CardDescription>
          Your account was provisioned with a temporary password. You must set a permanent password
          to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="change-password-user-email"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Account Email
            </label>
            <Input
              id="change-password-user-email"
              type="email"
              value={userEmail}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="current-temporary-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Temporary Password
            </label>
            <Input
              id="current-temporary-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your temporary password"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="new-admin-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              New Password
            </label>
            <Input
              id="new-admin-password"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 12 characters"
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 12 characters. Avoid common passwords or your username.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-admin-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Confirm New Password
            </label>
            <Input
              id="confirm-admin-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
            />
          </div>

          <Button type="submit" disabled={pending} className="w-full bg-forest-900 text-cream-50 hover:bg-forest-800">
            {pending ? "Updating Password..." : "Set New Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

