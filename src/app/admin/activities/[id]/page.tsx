import { EditCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditCmsContentPage entityType="activity" title="Activity" basePath="/admin/activities" id={(await params).id} />;
}
