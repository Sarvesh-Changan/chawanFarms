"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import type { CmsListRow } from "@/lib/types/cms";
import { restoreCmsEntityAction, reorderCmsEntityAction } from "@/server/actions/cms";
import type { CmsEntityType } from "@/server/services/cms/types";

export function CmsEntityTable({ entityType, rows, page, pageCount, pageSize, trash, canWrite, sort, direction }: {
  entityType: CmsEntityType;
  rows: CmsListRow[];
  page: number;
  pageCount: number;
  pageSize: number;
  trash: boolean;
  canWrite: boolean;
  sort: "sortOrder" | "updatedAt" | "status";
  direction: "asc" | "desc";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = entityType === "package" ? "/admin/cms/packages" : "/admin/cms/accommodations";

  function reorder(id: string, direction: "up" | "down") {
    startTransition(async () => {
      await reorderCmsEntityAction({ entityType, id, direction });
      router.refresh();
    });
  }

  function restore(id: string) {
    startTransition(async () => {
      await restoreCmsEntityAction({ entityType, id });
      router.refresh();
    });
  }

  const columns: ColumnDef<CmsListRow, string>[] = [
    { accessorKey: "label", header: "Name", enableSorting: false, cell: ({ row }) => trash ? row.original.label : <Link className="font-medium text-forest-800 underline-offset-4 hover:underline" href={`${base}/${row.original.id}`}>{row.original.label}</Link> },
    { accessorKey: "slug", header: "Slug", enableSorting: false, cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "updatedAt", header: "Updated", cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString("en-IN") },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => trash
      ? <Button type="button" size="sm" variant="outline" disabled={pending || !canWrite} onClick={() => restore(row.original.id)}>Restore</Button>
      : <div className="flex flex-wrap gap-1"><Button type="button" size="sm" variant="outline" aria-label={`Move ${row.original.label} up`} disabled={pending || !canWrite || page > 1 && row.index === 0} onClick={() => reorder(row.original.id, "up")}>↑</Button><Button type="button" size="sm" variant="outline" aria-label={`Move ${row.original.label} down`} disabled={pending || !canWrite} onClick={() => reorder(row.original.id, "down")}>↓</Button></div> },
  ];

  const initialSorting = sort === "sortOrder" ? [] : [{ id: sort, desc: direction === "desc" }];
  return <DataTable columns={columns} data={rows} page={page} pageCount={pageCount} pageSize={pageSize} initialSorting={initialSorting} emptyMessage={trash ? "Trash is empty." : "No CMS entries match these filters."} />;
}
