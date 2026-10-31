import Link from "next/link";

import { NewCmsContentPage } from "@/components/admin/cms/CmsContentAdminPage";
import { GalleryBatchUploader } from "@/components/admin/gallery/GalleryBatchUploader";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { getGalleryCategories } from "@/server/services/cms/gallery-categories";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function NewGalleryItemPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await getCmsPageStaff("cms.write");
  if (!staff) return <NoAccess />;

  const raw = searchParams ? await searchParams : {};
  const isSingle = raw.mode === "single";

  if (isSingle) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Create Gallery Item (Single)"
            description="Use single-item mode or switch to batch multiple upload."
          />
          <Button asChild variant="outline">
            <Link href="/admin/gallery/new">Switch to Multiple Upload</Link>
          </Button>
        </div>
        <NewCmsContentPage entityType="gallery-item" title="Gallery item" basePath="/admin/gallery" />
      </div>
    );
  }

  const categories = await getGalleryCategories();
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME ?? "";

  return (
    <section className="space-y-6">
      <PageHeader
        title="Upload Gallery Media"
        description="Select or drag multiple photos and videos, assign categories, and publish or save as draft."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/gallery/new?mode=single">Single item form</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin/gallery">Back to gallery</Link>
            </Button>
          </div>
        }
      />
      <GalleryBatchUploader initialCategories={categories} cloudName={cloudName} />
    </section>
  );
}
