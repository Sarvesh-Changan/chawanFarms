import { AuthForm } from "@/components/auth/AuthForm";
import { signupAction } from "@/server/auth/actions";

export default function SignupPage() {
  return <AuthForm mode="signup" action={signupAction} />;
}
