import { NewCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function NewMenuItemPage() {
  return <NewCmsContentPage entityType="menu-item" title="Menu item" basePath="/admin/menu?tab=items" editorPath="/admin/menu/menu-item" />;
}
