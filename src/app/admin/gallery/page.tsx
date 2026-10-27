import { CmsContentListPage } from "@/components/admin/cms/CmsContentAdminPage";

export default function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CmsContentListPage entityType="gallery-item" title="Gallery" basePath="/admin/gallery" searchParams={searchParams} />;
}
