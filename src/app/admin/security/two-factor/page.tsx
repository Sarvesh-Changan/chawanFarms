import { redirect } from "next/navigation";

import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";
import { getSession } from "@/server/auth";
import { getStaffPrincipal } from "@/server/authz";

type TwoFactorPageProps = {
  searchParams: Promise<{ callbackUrl?: string; step?: string }>;
};

export default async function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login?callbackUrl=%2Fadmin%2Fsecurity%2Ftwo-factor");
  }

  const staff = await getStaffPrincipal(session.user.id);
  if (!staff) {
    redirect("/admin/login");
  }

  // If password change is still pending, route to password change first
  if (staff.mustChangePassword) {
    redirect("/admin/security/change-password");
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10">
      <TwoFactorSetup callbackUrl={callbackUrl} />
    </div>
  );
}
