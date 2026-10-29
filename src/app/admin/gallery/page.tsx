import Link from "next/link";

import { GalleryManager } from "@/components/admin/gallery/GalleryManager";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/server/authz";
import { listGalleryAdmin } from "@/server/services/cms/content";
import { getGalleryCategories } from "@/server/services/cms/gallery-categories";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await getCmsPageStaff("cms.read"); if (!staff) return <NoAccess />;
  const raw = await searchParams;
  const value = (candidate: string | string[] | undefined) => typeof candidate === "string" ? candidate : "";
  const filters = { q: value(raw.q), status: value(raw.status), category: value(raw.category), duplicatesOnly: value(raw.duplicates) === "1" };
  const status = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(filters.status) ? filters.status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED" : undefined;
  const [data, canWrite, categories] = await Promise.all([
    listGalleryAdmin({ q: filters.q, status, category: filters.category || undefined, duplicatesOnly: filters.duplicatesOnly }),
    can(staff, "cms.write"),
    getGalleryCategories(),
  ]);
  const rows = data.rows.map((row) => ({ id: row.id, category: row.category, status: row.status, sortOrder: row.sortOrder, isFeatured: row.isFeatured, media: row.media }));
  return (
    <section className="space-y-6">
      <PageHeader
        title="Gallery"
        description="Manage images, videos, categories, publication, featured state and order."
        actions={
          <Button asChild>
            <Link href="/admin/gallery/new">Upload media</Link>
          </Button>
        }
      />
      <GalleryManager
        rows={rows}
        categories={categories}
        categoryCounts={data.categoryCounts}
        filters={filters}
        canWrite={canWrite}
      />
    </section>
  );
}
