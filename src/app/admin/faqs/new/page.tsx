import { NewCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function NewFaqPage() {
  return <NewCmsContentPage entityType="faq" title="FAQ" basePath="/admin/faqs" />;
}
