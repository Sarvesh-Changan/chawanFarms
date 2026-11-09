"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LoginFormProps = {
  defaultValues?: {
    callbackUrl?: string;
  };
  urlError?: string;
  urlErrorDescription?: string;
};

export function LoginForm({ defaultValues = {}, urlError, urlErrorDescription }: LoginFormProps) {
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(() => {
    if (!urlError) return null;
    if (urlError === "staff_account_not_allowed") {
      return "This email belongs to a staff account. Please sign in at the admin login page.";
    }
    if (urlError === "access_denied") {
      return "Google sign-in was cancelled. Please try again when you are ready.";
    }
    if (urlError === "email_not_verified") {
      return "Your Google account email is not verified. Please verify your email with Google and try again.";
    }
    if (urlError === "state_not_found" || urlError === "invalid_callback_request") {
      return "The sign-in request could not be validated. Please try again.";
    }
    return urlErrorDescription || "Unable to sign in with Google. Please try again.";
  });

  const handleGoogleSignIn = async () => {
    setGoogleError(null);
    setGooglePending(true);
    try {
      const targetCallback = defaultValues.callbackUrl || "/account";
      const errorRedirect = `/login?callbackUrl=${encodeURIComponent(targetCallback)}`;

      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: targetCallback,
          errorURL: errorRedirect,
        }),
      });

      const data = (await res.json()) as { url?: string; message?: string };
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        setGoogleError(data?.message || "Unable to initiate Google sign-in. Please try again.");
        setGooglePending(false);
      }
    } catch {
      setGoogleError("Connection error while contacting Google. Please check your network and try again.");
      setGooglePending(false);
    }
  };

  return (
    <main className="bg-cream-50 flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-forest-900/10 bg-clay-100/70 shadow-xl">
        <CardHeader className="gap-3 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3">
            <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">
              Chawan Farms
            </p>
          </div>
          <CardTitle className="font-heading text-center text-2xl text-forest-900 sm:text-3xl">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center">
            Sign in with Google to manage your bookings and rewards.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0 space-y-4">
          {googleError ? (
            <div
              role="alert"
              className="rounded-lg border border-laterite-600/20 bg-laterite-50/80 p-3.5 text-xs text-laterite-700 sm:text-sm"
            >
              <p>{googleError}</p>
              {urlError === "staff_account_not_allowed" && (
                <a
                  href="/admin/login"
                  className="mt-2.5 inline-block text-xs font-semibold text-laterite-700 underline underline-offset-4 hover:text-laterite-900"
                >
                  Go to Admin login →
                </a>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googlePending}
            aria-label="Continue with Google"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{googlePending ? "Redirecting to Google…" : "Continue with Google"}</span>
          </button>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Only customer accounts may sign in with Google.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
