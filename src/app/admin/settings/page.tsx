import { SettingsEditor } from "@/components/admin/cms/SettingsEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { env } from "@/config/env";
import { can } from "@/server/authz";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { getCmsSettings } from "@/server/services/cms/settings";

export default async function AdminSettingsPage() {
  const staff = await getCmsPageStaff("settings.read");
  if (!staff) return <NoAccess />;
  const [initial, canWrite] = await Promise.all([getCmsSettings(), can(staff, "settings.write")]);
  return <section className="space-y-6"><PageHeader title="Settings" description="Manage public contact details, home-page content and staff security." /><SettingsEditor initial={initial} canWrite={canWrite} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME} /></section>;
}
