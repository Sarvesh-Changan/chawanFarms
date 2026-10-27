import { EditCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditCmsContentPage entityType="post" title="Story" basePath="/admin/stories" id={(await params).id} />;
}
