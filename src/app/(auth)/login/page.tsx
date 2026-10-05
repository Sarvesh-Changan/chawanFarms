import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "@/server/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/account";
  return <AuthForm mode="login" action={loginAction} defaultValues={{ callbackUrl }} />;
}
