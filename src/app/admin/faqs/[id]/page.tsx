import { EditCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditCmsContentPage entityType="faq" title="FAQ" basePath="/admin/faqs" id={(await params).id} />;
}
