import Link from "next/link";
import { notFound } from "next/navigation";

import { CmsContentDataTable } from "@/components/admin/cms/CmsContentDataTable";
import { CmsContentEditor } from "@/components/admin/cms/CmsContentEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { CMS_CONTENT_TYPES, type CmsContentType } from "@/config/cms-content";
import { env } from "@/config/env";
import { cmsContentListQuerySchema } from "@/lib/schemas/cms/content";
import { getCmsContent, getCmsEditorOptions, listCmsContent } from "@/server/services/cms/content";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export type CmsContentListRow = { id: string; label: string; slug: string; status: string; updatedAt: string };

export type CmsContentRouteProps = {
  entityType: CmsContentType;
  title: string;
  basePath: string;
  editorPath?: string;
  tab?: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function labelOf(row: Record<string, unknown>) {
  for (const candidate of [row.title, row.name, row.question, row.quote]) {
    if (candidate && typeof candidate === "object" && "en" in candidate) return String((candidate as { en?: unknown }).en ?? "");
  }
  return String(row.authorName ?? "");
}

function pathWithQuery(path: string, query: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

export async function CmsContentListPage({ entityType, title, basePath, editorPath = basePath, tab, searchParams }: CmsContentRouteProps) {
  if (!CMS_CONTENT_TYPES.includes(entityType)) notFound();
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const raw = searchParams ? await searchParams : {};
  const query = cmsContentListQuerySchema.safeParse({ ...raw, entityType });
  if (!query.success) notFound();
  const result = await listCmsContent({ entityType, page: query.data.page, q: query.data.q, status: query.data.status, trash: query.data.trash });
  const rows: CmsContentListRow[] = result.rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug ?? ""),
    label: labelOf(row),
    status: String(row.status ?? "—"),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toLocaleDateString("en-IN") : "—",
  }));
  const listHref = tab ? pathWithQuery(basePath, `tab=${tab}`) : basePath;
  return <section className="space-y-6">
    <PageHeader title={query.data.trash ? `${title} trash` : title} description="New content is saved as a draft. Publish only client-approved details." actions={<>
      <Button asChild><Link href={`${editorPath}/new`}>Create</Link></Button>
      <Button asChild variant="outline"><Link href={pathWithQuery(listHref, "trash=1")}>Trash</Link></Button>
    </>} />
    {query.data.trash ? <p className="text-sm text-muted-foreground">Showing trashed records. Restore is available when editing an item.</p> : null}
    <CmsContentDataTable rows={rows} editorPath={editorPath} page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} emptyMessage={`No ${title.toLowerCase()} yet.`} />
  </section>;
}

export async function NewCmsContentPage({ entityType, title, basePath, editorPath = basePath }: Omit<CmsContentRouteProps, "searchParams">) {
  const staff = await getCmsPageStaff("cms.write");
  if (!staff) return <NoAccess />;
  const editorOptions = await getCmsEditorOptions(entityType);
  return <section className="space-y-6"><PageHeader title={`Create ${title.toLowerCase()}`} description="Save as draft; publishing requires the appropriate permission." /><CmsContentEditor entityType={entityType} editorPath={editorPath} listPath={basePath} {...editorOptions} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME ?? ""} /></section>;
}

export async function EditCmsContentPage({ entityType, title, basePath, editorPath = basePath, id }: Omit<CmsContentRouteProps, "searchParams"> & { id: string }) {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const item = await getCmsContent(entityType, id);
  if (!item) notFound();
  const editorOptions = await getCmsEditorOptions(entityType);
  return <section className="space-y-6"><PageHeader title={`Edit ${title.toLowerCase()}`} description={`Status: ${"status" in item ? item.status : "—"}`} /><CmsContentEditor entityType={entityType} id={id} item={item as unknown as Record<string, unknown>} editorPath={editorPath} listPath={basePath} {...editorOptions} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME ?? ""} /></section>;
}
