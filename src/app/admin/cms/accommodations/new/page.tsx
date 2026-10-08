import { AccommodationEditor } from "@/components/admin/cms/AccommodationEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { env } from "@/config/env";
import { can } from "@/server/authz";
import { getCmsHeroMediaOptions } from "@/server/services/cms/options";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function NewAccommodationPage() {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const permissions = await Promise.all([can(staff, "cms.write"), can(staff, "cms.publish"), can(staff, "cms.delete"), can(staff, "media.read")]);
  const mediaOptions = permissions[3] ? await getCmsHeroMediaOptions() : [];
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME;
  return <AccommodationEditor initial={{ slug: "", type: "TENT", name: { en: "", mr: "", hi: "" }, summary: { en: "", mr: "", hi: "" }, description: { en: "", mr: "", hi: "" }, unitsTotal: "", maxGuests: "", amenities: { en: "", mr: "", hi: "" }, heroMediaId: "", imageMediaIds: [], status: "DRAFT" }} mediaOptions={mediaOptions} cloudName={cloudName} canWrite={permissions[0]} canPublish={permissions[1]} canDelete={permissions[2]} />;
}
