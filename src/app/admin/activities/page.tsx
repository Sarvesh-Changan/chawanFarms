import { CmsContentListPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function ActivitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CmsContentListPage entityType="activity" title="Activities" basePath="/admin/activities" searchParams={searchParams} />;
}
