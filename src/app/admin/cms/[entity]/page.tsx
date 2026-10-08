import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { CMS_CONTENT_TYPES, type CmsContentType } from "@/config/cms-content";
import { cmsContentListQuerySchema } from "@/lib/schemas/cms/content";
import { listCmsContent } from "@/server/services/cms/content";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

type Row = { id: string; label: string; slug: string; status: string; updatedAt: string; sortOrder: number };
function labelForType(type: CmsContentType): string {
  switch (type) {
    case "activity": return "Activities"; case "experience": return "Experiences";
    case "menu-category": return "Menu categories"; case "menu-item": return "Menu items";
    case "faq": return "FAQs"; case "offer": return "Offers"; case "testimonial": return "Testimonials";
    case "gallery-item": return "Gallery"; case "post": return "Stories"; case "post-category": return "Story categories";
  }
}

function routeForType(type: CmsContentType): string {
  switch (type) {
    case "activity": return "activities"; case "experience": return "experiences";
    case "menu-category": return "menu-categories"; case "menu-item": return "menu-items";
    case "faq": return "faqs"; case "offer": return "offers"; case "testimonial": return "testimonials";
    case "gallery-item": return "gallery"; case "post": return "stories"; case "post-category": return "story-categories";
  }
}

export default async function CmsContentListPage({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { entity } = await params;
  if (!CMS_CONTENT_TYPES.includes(entity as CmsContentType)) notFound();
  const type = entity as CmsContentType;
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const query = cmsContentListQuerySchema.safeParse({ ...(await searchParams), entityType: type });
  if (!query.success) notFound();
  const result = await listCmsContent({ entityType: type, page: query.data.page, q: query.data.q, status: query.data.status, trash: query.data.trash });
  const rows = result.rows.map((row) => ({ id: String(row.id), slug: String(row.slug ?? ""), label: labelOf(row), status: String(row.status ?? "—"), sortOrder: Number(row.sortOrder ?? 0), updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toLocaleDateString() : "—" }));
  const columns: ColumnDef<Row, string>[] = [
    { accessorKey: "label", header: "Title", cell: ({ row }) => <Link className="font-medium text-forest-800 underline-offset-4 hover:underline" href={`/admin/cms/${type}/${row.original.id}`}>{row.original.label || row.original.slug || row.original.id}</Link> },
    { accessorKey: "slug", header: "Slug" }, { accessorKey: "status", header: "Status" }, { accessorKey: "updatedAt", header: "Updated" },
  ];
  const route = routeForType(type);
  const label = labelForType(type);
  return <section className="space-y-6"><PageHeader title={label} description="New content is saved as a draft. Publish only client-approved details." actions={<><Button asChild><Link href={`/admin/cms/${type}/new`}>Create</Link></Button><Button asChild variant="outline"><Link href={`/admin/cms/${type}?trash=1`}>Trash</Link></Button></>} />
    {query.data.trash ? <p className="text-sm text-muted-foreground">Showing trashed records. Restore is available when editing an item.</p> : null}
    <DataTable columns={columns} data={rows} page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} emptyMessage={`No ${label.toLowerCase()} yet.`} />
    <p className="text-xs text-muted-foreground">Admin route: /admin/cms/{route}</p></section>;
}

function labelOf(row: Record<string, unknown>) {
  for (const candidate of [row.title, row.name, row.question, row.quote]) {
    if (candidate && typeof candidate === "object" && "en" in candidate) return String((candidate as { en?: unknown }).en ?? "");
  }
  return String(row.authorName ?? "");
}
