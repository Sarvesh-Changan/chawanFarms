import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { safeCallbackUrl } from "@/lib/safe-url";
import { getSession } from "@/server/auth";
import { signupAction } from "@/server/auth/actions";
import { resolveUserPostLogin } from "@/server/auth/post-login";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/account");
  const session = await getSession();
  if (session) {
    const destination = await resolveUserPostLogin(session.user.id, callbackUrl, { emailVerified: true });
    if (destination) redirect(destination.redirectTo);
  }
  return <AuthForm mode="signup" action={signupAction} defaultValues={{ callbackUrl }} />;
}
