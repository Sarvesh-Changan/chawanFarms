import { CmsContentListPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function LegacyExperiencesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CmsContentListPage entityType="experience" title="Experiences (legacy)" basePath="/admin/experiences-legacy" searchParams={searchParams} />;
}
