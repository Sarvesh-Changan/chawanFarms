import { EditCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function EditMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditCmsContentPage entityType="menu-item" title="Menu item" basePath="/admin/menu?tab=items" editorPath="/admin/menu/menu-item" id={(await params).id} />;
}
