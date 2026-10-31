import { EditCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function EditLegacyExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  return <EditCmsContentPage entityType="experience" title="Experience" basePath="/admin/experiences-legacy" id={(await params).id} />;
}
