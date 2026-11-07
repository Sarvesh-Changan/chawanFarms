import { permanentRedirect } from "next/navigation";

import { StaffPasswordResetForm } from "@/components/auth/StaffPasswordResetForm";

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

  permanentRedirect("/login");
}
