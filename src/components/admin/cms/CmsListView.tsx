import Link from "next/link";

import { CmsEntityTable } from "@/components/admin/cms/CmsEntityTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublishStatus } from "@/generated/prisma/client";
import type { CmsListRow } from "@/lib/types/cms";
import type { CmsEntityType } from "@/server/services/cms/types";

export function CmsListView({ entityType, data, canWrite, trash, filters }: {
  entityType: CmsEntityType;
  data: { rows: CmsListRow[]; total: number; page: number; pageSize: number; pageCount: number };
  canWrite: boolean;
  trash: boolean;
  filters: { q: string; status?: PublishStatus; sort: "sortOrder" | "updatedAt" | "status"; direction: "asc" | "desc" };
}) {
  const basePath = entityType === "package" ? "/admin/cms/packages" : "/admin/cms/accommodations";
  const title = entityType === "package" ? "Packages" : "Accommodation";
  return <section className="space-y-6">
    <PageHeader title={trash ? `${title} trash` : title} description={trash ? "Restore soft-deleted entries." : `Manage ${entityType} catalogue records and publication order.`} actions={<>
      <Button asChild variant="outline"><Link href={trash ? basePath : `${basePath}/trash`}>{trash ? "Back to list" : "Trash"}</Link></Button>
      {!trash && canWrite ? <Button asChild><Link href={`${basePath}/new`}>Create {entityType}</Link></Button> : null}
    </>} />
    {!trash ? <form action={basePath} method="get" className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_14rem_auto]">
      <label className="grid gap-1 text-xs font-medium">Search by slug or package code<Input name="q" defaultValue={filters.q} /></label>
      <label className="grid gap-1 text-xs font-medium">Publication status<select name="status" defaultValue={filters.status ?? ""} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
      <Button type="submit" variant="outline" className="self-end">Apply filters</Button>
      <input type="hidden" name="sort" value={filters.sort} /><input type="hidden" name="direction" value={filters.direction} />
    </form> : null}
    <p className="text-sm text-muted-foreground">{data.total} {trash ? "trashed" : "active"} entries</p>
    <CmsEntityTable entityType={entityType} rows={data.rows} page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} trash={trash} canWrite={canWrite} sort={filters.sort} direction={filters.direction} />
  </section>;
}
