import { AuthForm } from "@/components/auth/AuthForm";
import { StaffPasswordResetForm } from "@/components/auth/StaffPasswordResetForm";
import { forgotPasswordAction } from "@/server/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string; admin?: string }>;
}) {
  const params = await searchParams;
  const isStaff = params?.role === "admin" || params?.admin === "true";

  if (isStaff) {
    return <StaffPasswordResetForm />;
  }

  return <AuthForm mode="forgot" action={forgotPasswordAction} />;
}
