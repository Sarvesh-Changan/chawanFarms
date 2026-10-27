import { CmsContentListPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function StoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CmsContentListPage entityType="post" title="Stories" basePath="/admin/stories" searchParams={searchParams} />;
}
