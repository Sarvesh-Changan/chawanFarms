import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import type { Permission } from "@/server/authz/permissions";

export async function getCmsPageStaff(permission: Permission) {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=%2Fadmin%2Fcms");
  const staff = await getStaffPrincipal(session.user.id);
  return staff && await can(staff, permission) ? staff : null;
}

