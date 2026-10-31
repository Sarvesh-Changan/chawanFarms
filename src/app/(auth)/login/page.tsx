import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { safeCallbackUrl } from "@/lib/safe-url";
import { getSession } from "@/server/auth";
import { loginAction } from "@/server/auth/actions";
import { resolveUserPostLogin } from "@/server/auth/post-login";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/account");
  const session = await getSession();
  if (session) {
    const destination = await resolveUserPostLogin(session.user.id, callbackUrl, { emailVerified: true });
    if (destination) redirect(destination.redirectTo);
  }
  const isInactivityTimeout = params.reason === "inactivity";

  return (
    <div className="space-y-4">
      {isInactivityTimeout && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-medium">
            <svg
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeWidth="2" d="M12 6v6l4 2" />
            </svg>
            Session timed out
          </div>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            You were signed out due to 30 minutes of inactivity. Please sign in again to continue.
          </p>
        </div>
      )}
      <AuthForm mode="login" action={loginAction} defaultValues={{ callbackUrl }} />
    </div>
  );
}
