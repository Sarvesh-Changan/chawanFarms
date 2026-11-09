import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { getSession } from "@/server/auth";
import { getStaffPrincipal } from "@/server/authz";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login?callbackUrl=%2Fadmin%2Fsecurity%2Fchange-password");
  }

  const staff = await getStaffPrincipal(session.user.id);
  if (!staff) {
    redirect("/admin/login");
  }

  if (!staff.mustChangePassword) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10">
      <ChangePasswordForm userEmail={session.user.email} />
    </div>
  );
}

