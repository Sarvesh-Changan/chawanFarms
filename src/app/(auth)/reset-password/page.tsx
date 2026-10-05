import { AuthForm } from "@/components/auth/AuthForm";
import { resetPasswordAction } from "@/server/auth/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <AuthForm mode="reset" action={resetPasswordAction} defaultValues={{ token }} />;
}
