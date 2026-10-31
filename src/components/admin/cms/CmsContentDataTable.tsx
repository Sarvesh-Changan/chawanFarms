"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import type { CmsContentListRow } from "@/components/admin/cms/CmsContentAdminPage";
import { DataTable } from "@/components/admin/DataTable";

export function CmsContentDataTable({ rows, editorPath, page, pageCount, pageSize, emptyMessage }: {
  rows: CmsContentListRow[];
  editorPath: string;
  page: number;
  pageCount: number;
  pageSize: number;
  emptyMessage: string;
}) {
  const columns: ColumnDef<CmsContentListRow, string>[] = [
    { accessorKey: "label", header: "Title", cell: ({ row }) => <Link className="font-medium text-forest-800 underline-offset-4 hover:underline" href={`${editorPath}/${row.original.id}`}>{row.original.label || row.original.slug || row.original.id}</Link> },
    { accessorKey: "slug", header: "Slug" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "updatedAt", header: "Updated" },
  ];

  return <DataTable columns={columns} data={rows} page={page} pageCount={pageCount} pageSize={pageSize} emptyMessage={emptyMessage} />;
}
