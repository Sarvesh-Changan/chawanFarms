"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  completeStaffResetPasswordAction,
  requestStaffResetOtpAction,
  verifyStaffResetOtpAction,
} from "@/server/auth/actions";

type Step = "request" | "verify" | "reset";

export function StaffPasswordResetForm() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [grantToken, setGrantToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverMessage, setServerMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(undefined);
    setServerMessage(undefined);

    startTransition(async () => {
      const res = await requestStaffResetOtpAction({ email });
      if (!res.ok) {
        setErrorMessage(res.message);
        return;
      }
      setServerMessage(res.message);
      setStep("verify");
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(undefined);
    setServerMessage(undefined);

    startTransition(async () => {
      const res = await verifyStaffResetOtpAction({ email, code });
      if (!res.ok || !res.grantToken) {
        setErrorMessage(res.message);
        return;
      }
      setGrantToken(res.grantToken);
      setStep("reset");
    });
  };

  const handleCompleteReset = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(undefined);
    setServerMessage(undefined);

    if (!Object.is(password, confirmPassword)) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const res = await completeStaffResetPasswordAction({
        grantToken,
        password,
        confirmPassword,
      });

      if (!res.ok) {
        setErrorMessage(res.message);
        return;
      }

      setIsSuccess(true);
      setServerMessage(res.message);
      if (res.redirectTo) {
        const destination = res.redirectTo;
        setTimeout(() => {
          window.location.assign(destination);
        }, 1500);
      }
    });
  };

  return (
    <main className="bg-cream-50 flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-forest-900/10 bg-clay-100/70 shadow-xl">
        <CardHeader className="gap-3 p-6 sm:p-8">
          <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Staff Access</p>
          <CardTitle className="font-heading text-3xl text-forest-900">
            {step === "request" && "Reset Staff Password"}
            {step === "verify" && "Enter Security Code"}
            {step === "reset" && "Choose New Password"}
          </CardTitle>
          <CardDescription>
            {step === "request" && "Enter your registered staff email address to receive a one-time verification code."}
            {step === "verify" && `Enter the 6-digit verification code sent to ${email}.`}
            {step === "reset" && "Choose a strong password (minimum 12 characters)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
          {serverMessage ? (
            <p className="bg-paddy-300/30 text-forest-900 mb-5 rounded-lg p-3 text-sm" role="status">
              {serverMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="text-laterite-600 mb-5 text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {step === "request" && (
            <form className="grid gap-4" onSubmit={handleRequestOtp}>
              <label className="grid gap-2 text-sm font-semibold">
                Staff Email
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@chawanfarms.com"
                />
              </label>
              <Button type="submit" disabled={pending || !email} className="mt-2 w-full">
                {pending ? "Sending code…" : "Send verification code"}
              </Button>
            </form>
          )}

          {step === "verify" && (
            <form className="grid gap-4" onSubmit={handleVerifyOtp}>
              <label className="grid gap-2 text-sm font-semibold">
                6-Digit Verification Code
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
              </label>
              <Button type="submit" disabled={pending || code.length !== 6} className="mt-2 w-full">
                {pending ? "Verifying…" : "Verify code"}
              </Button>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => setStep("request")}
                >
                  Change email
                </button>
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  disabled={pending}
                  onClick={handleRequestOtp}
                >
                  Send new code
                </button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <form className="grid gap-4" onSubmit={handleCompleteReset}>
              <label className="grid gap-2 text-sm font-semibold">
                New Password (min 12 chars)
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Confirm Password
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={pending || !password || isSuccess} className="mt-2 w-full">
                {pending ? "Updating password…" : "Reset password & revoke other sessions"}
              </Button>
            </form>
          )}

          <div className="text-muted-foreground mt-6 flex justify-between gap-3 text-sm">
            <Link className="underline underline-offset-4" href="/admin/login">
              Back to admin login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

