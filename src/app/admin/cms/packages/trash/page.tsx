import { CmsListView } from "@/components/admin/cms/CmsListView";
import { NoAccess } from "@/components/admin/NoAccess";
import { cmsListQuerySchema } from "@/lib/schemas/cms/common";
import { can } from "@/server/authz";
import { toCmsListRow } from "@/server/services/cms/list-utils";
import { listPackages } from "@/server/services/cms/packages";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function PackageTrashPage() {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const query = cmsListQuerySchema.parse({ trash: "1" });
  const [result, canWrite] = await Promise.all([
    listPackages({ page: query.page, search: "", trash: true, sort: query.sort, direction: query.direction }),
    can(staff, "cms.write"),
  ]);
  return <CmsListView entityType="package" data={{ ...result, rows: result.rows.map(toCmsListRow) }} canWrite={canWrite} trash filters={{ q: "", sort: query.sort, direction: query.direction }} />;
}
