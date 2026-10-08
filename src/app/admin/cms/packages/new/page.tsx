import { PackageEditor } from "@/components/admin/cms/PackageEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { env } from "@/config/env";
import { can } from "@/server/authz";
import { getCmsHeroMediaOptions } from "@/server/services/cms/options";
import { listPackageRelationOptions } from "@/server/services/cms/packages";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function NewPackagePage() {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const [permissions, options] = await Promise.all([
    Promise.all([can(staff, "cms.write"), can(staff, "cms.publish"), can(staff, "cms.delete"), can(staff, "media.read")]),
    listPackageRelationOptions(),
  ]);
  const [canWrite, canPublish, canDelete] = permissions;
  const mediaOptions = permissions[3] ? await getCmsHeroMediaOptions() : [];
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME;
  return <PackageEditor initial={{ slug: "", code: "", name: { en: "", mr: "", hi: "" }, summary: { en: "", mr: "", hi: "" }, description: { en: "", mr: "", hi: "" }, inclusions: { en: "", mr: "", hi: "" }, conditions: { en: "", mr: "", hi: "" }, timingNote: { en: "", mr: "", hi: "" }, minGuests: "", maxGuests: "", isDayVisit: false, isGroupOnly: false, heroMediaId: "", accommodationIds: [], activityIds: [], status: "DRAFT" }} rates={[]} accommodationOptions={options.accommodations} activityOptions={options.activities} mediaOptions={mediaOptions} cloudName={cloudName} canWrite={canWrite} canPublish={canPublish} canDelete={canDelete} />;
}
