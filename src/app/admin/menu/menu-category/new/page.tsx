import { NewCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function NewMenuCategoryPage() {
  return <NewCmsContentPage entityType="menu-category" title="Menu category" basePath="/admin/menu?tab=categories" editorPath="/admin/menu/menu-category" />;
}
