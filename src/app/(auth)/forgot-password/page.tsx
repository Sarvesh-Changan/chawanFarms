import { AuthForm } from "@/components/auth/AuthForm";
import { forgotPasswordAction } from "@/server/auth/actions";

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" action={forgotPasswordAction} />;
}
