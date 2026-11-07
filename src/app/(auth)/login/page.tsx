import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { safeCallbackUrl } from "@/lib/safe-url";
import { getSession } from "@/server/auth";
import { loginAction } from "@/server/auth/actions";
import { resolveUserPostLogin } from "@/server/auth/post-login";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCallback = typeof params.callbackUrl === "string" ? params.callbackUrl : undefined;
  const callbackUrl = safeCallbackUrl(rawCallback, "/account");

  const session = await getSession();
  if (session) {
    const destination = await resolveUserPostLogin(session.user.id, callbackUrl, { emailVerified: true });
    if (destination) redirect(destination.redirectTo);
  }

  const isInactivityTimeout = params.reason === "inactivity";
  const urlError = typeof params.error === "string" ? params.error : undefined;
  const urlErrorDescription = typeof params.error_description === "string" ? params.error_description : undefined;

  const isAdminRequested =
    params.tab === "admin" ||
    params.role === "admin" ||
    (typeof rawCallback === "string" && (rawCallback.startsWith("/admin") || rawCallback.includes("/admin")));

  const initialTab: "user" | "admin" = isAdminRequested ? "admin" : "user";

  return (
    <div className="space-y-4">
      {isInactivityTimeout && (
        <div
          role="alert"
          aria-live="polite"
          className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
        >
          <div className="flex items-center gap-2 font-medium">
            <svg
              className="h-4 w-4 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeWidth="2" d="M12 6v6l4 2" />
            </svg>
            Session timed out
          </div>
          <p className="mt-1 text-xs text-amber-800">
            You were signed out due to 30 minutes of inactivity. Please sign in again to continue.
          </p>
        </div>
      )}
      <LoginForm
        adminAction={loginAction}
        defaultValues={{ callbackUrl }}
        initialTab={initialTab}
        urlError={urlError}
        urlErrorDescription={urlErrorDescription}
      />
    </div>
  );
}
