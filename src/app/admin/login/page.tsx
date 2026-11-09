import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { safeCallbackUrl } from "@/lib/safe-url";
import { getSession } from "@/server/auth";
import { loginAction } from "@/server/auth/actions";
import { resolveUserPostLogin } from "@/server/auth/post-login";
import { getStaffPrincipal } from "@/server/authz";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCallback = typeof params.callbackUrl === "string" ? params.callbackUrl : undefined;
  // Only allow callbackUrls under /admin for safety
  const callbackUrl = safeCallbackUrl(rawCallback, "/admin");

  const session = await getSession();
  if (session) {
    const staff = await getStaffPrincipal(session.user.id);
    if (staff) {
      const destination = await resolveUserPostLogin(session.user.id, callbackUrl, {
        emailVerified: true,
      });
      if (destination) redirect(destination.redirectTo);
      redirect("/admin");
    }
    // Authenticated customer ended up here — send them to their account
    redirect("/account");
  }

  const isInactivityTimeout = params.reason === "inactivity";

  return (
    <AdminLoginForm
      adminAction={loginAction}
      defaultValues={{ callbackUrl }}
      isInactivityTimeout={isInactivityTimeout}
    />
  );
}

