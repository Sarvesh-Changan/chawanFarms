import { EditCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function EditGalleryItemPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditCmsContentPage entityType="gallery-item" title="Gallery item" basePath="/admin/gallery" id={(await params).id} />;
}
