import { redirect } from "next/navigation";

export default function TwoFactorPage() {
  redirect("/admin/security/staff");
}
