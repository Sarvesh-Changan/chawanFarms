import { NewCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function NewStoryPage() {
  return <NewCmsContentPage entityType="post" title="Story" basePath="/admin/stories" />;
}
