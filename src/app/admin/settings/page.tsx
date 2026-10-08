import { SettingsEditor } from "@/components/admin/cms/SettingsEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can } from "@/server/authz";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { getCmsSettings } from "@/server/services/cms/settings";

export default async function AdminSettingsPage() {
  const staff = await getCmsPageStaff("settings.read");
  if (!staff) return <NoAccess />;
  const [initial, canWrite] = await Promise.all([getCmsSettings(), can(staff, "settings.write")]);
  return <section className="space-y-6"><PageHeader title="Business settings" description="Manage business contact details, booking defaults and notification recipients." /><SettingsEditor initial={initial} canWrite={canWrite} /></section>;
}
