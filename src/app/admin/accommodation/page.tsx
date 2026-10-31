import { CmsListView } from "@/components/admin/cms/CmsListView";
import { NoAccess } from "@/components/admin/NoAccess";
import { cmsListQuerySchema } from "@/lib/schemas/cms/common";
import { can } from "@/server/authz";
import { listAccommodations } from "@/server/services/cms/accommodations";
import { toCmsListRow } from "@/server/services/cms/list-utils";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

function queryObject(raw: Record<string, string | string[] | undefined>) { return Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]])); }

export default async function AccommodationListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const params = cmsListQuerySchema.safeParse(queryObject(await searchParams));
  if (!params.success) return <NoAccess title="Invalid catalogue filters" message="Clear the filters and try again." />;
  const query = params.data;
  const [result, canWrite] = await Promise.all([listAccommodations({ page: query.page, search: query.q, status: query.status, trash: Boolean(query.trash), sort: query.sort, direction: query.direction }), can(staff, "cms.write")]);
  return <CmsListView entityType="accommodation" data={{ ...result, rows: result.rows.map(toCmsListRow) }} canWrite={canWrite} trash={Boolean(query.trash)} basePath="/admin/accommodation" filters={{ q: query.q, status: query.status, sort: query.sort, direction: query.direction }} />;
}
