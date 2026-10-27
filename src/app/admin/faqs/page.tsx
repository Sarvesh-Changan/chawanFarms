import { CmsContentListPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function FaqsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CmsContentListPage entityType="faq" title="FAQ" basePath="/admin/faqs" searchParams={searchParams} />;
}
