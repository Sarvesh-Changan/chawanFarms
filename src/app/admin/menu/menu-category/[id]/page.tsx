import { EditCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function EditMenuCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditCmsContentPage entityType="menu-category" title="Menu category" basePath="/admin/menu?tab=categories" editorPath="/admin/menu/menu-category" id={(await params).id} />;
}
