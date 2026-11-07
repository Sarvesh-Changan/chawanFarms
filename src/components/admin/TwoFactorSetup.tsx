"use client";

import { Check, Copy, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { startTwoFactorSetupAction, verifyTwoFactorSetupAction } from "@/server/actions/admin-security";

export function TwoFactorSetup({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [setupData, setSetupData] = useState<{ totpURI: string; secret: string; backupCodes: string[] } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    async function loadSetup() {
      const res = await startTwoFactorSetupAction();
      if (res.ok) {
        setSetupData(res.data);
      } else {
        setErrorMessage(res.error.message);
      }
      setLoading(false);
    }
    void loadSetup();
  }, []);

  const handleCopySecret = async () => {
    if (!setupData?.secret) return;
    await navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyCodes = async () => {
    if (!setupData?.backupCodes) return;
    await navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setErrorMessage("Please enter a valid 6-digit code from your authenticator app.");
      return;
    }

    startTransition(async () => {
      const res = await verifyTwoFactorSetupAction({ code: verificationCode.trim() });
      if (!res.ok) {
        setErrorMessage(res.error.message);
        return;
      }

      setSuccessMessage("Two-factor authentication successfully enabled!");
      setTimeout(() => {
        const dest = callbackUrl || "/admin";
        router.push(dest);
        router.refresh();
      }, 1000);
    });
  };

  if (loading) {
    return (
      <Card className="mx-auto w-full max-w-lg shadow-md">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Preparing two-factor configuration...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg shadow-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-forest-700" />
          <CardTitle className="font-heading text-2xl text-forest-900">
            Set Up Two-Factor Authentication
          </CardTitle>
        </div>
        <CardDescription>
          Your role requires two-factor authentication (TOTP). Scan the QR code with Google
          Authenticator, 1Password, or any standard authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="rounded-md border border-forest-600/20 bg-forest-50 p-3 text-sm text-forest-900"
          >
            {successMessage}
          </div>
        )}

        {setupData && (
          <>
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-cream-50/50 p-4">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <QRCodeSVG value={setupData.totpURI} size={180} level="M" />
              </div>

              <div className="w-full text-center">
                <p className="text-xs font-medium text-muted-foreground">Can&apos;t scan? Enter key manually:</p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 font-mono text-xs tracking-wider text-foreground">
                    {setupData.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={handleCopySecret}
                    aria-label="Copy secret key"
                  >
                    {copiedSecret ? <Check className="size-3.5 text-forest-600" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Backup Recovery Codes
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCodes}
                  className="h-7 text-xs"
                >
                  {copiedCodes ? "Copied" : "Copy Codes"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Save these backup codes in a safe place. You can use them if you lose access to your device.
              </p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-xs text-foreground">
                {setupData.backupCodes.map((code) => (
                  <div key={code} className="rounded bg-background px-2 py-1 border text-center">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="totp-verification-code"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  6-Digit Verification Code
                </label>
                <Input
                  id="totp-verification-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-widest"
                />
              </div>

              <Button
                type="submit"
                disabled={pending || !verificationCode}
                className="w-full bg-forest-900 text-cream-50 hover:bg-forest-800"
              >
                {pending ? "Verifying..." : "Verify and Enable 2FA"}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

