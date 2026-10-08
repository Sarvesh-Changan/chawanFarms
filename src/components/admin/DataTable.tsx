"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type DataTableProps<TData> = {
  columns: ColumnDef<TData, string>[];
  data: TData[];
  page: number;
  pageCount: number;
  pageSize: number;
  initialSorting?: SortingState;
  onPageChange?: (page: number) => void;
  onSortChange?: (sorting: SortingState) => void;
  emptyMessage?: string;
};

export function DataTable<TData>({ columns, data, page, pageCount, pageSize, initialSorting = [], onPageChange, onSortChange, emptyMessage = "No records found." }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  function updateQuery(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }
  // TanStack Table's mutable table instance is intentionally kept within this client component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount,
    state: { sorting, pagination: { pageIndex: page - 1, pageSize } },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      onSortChange?.(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next[0]) {
        params.set("sort", next[0].id);
        params.set("direction", next[0].desc ? "desc" : "asc");
      } else {
        params.delete("sort");
        params.delete("direction");
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-muted/70 text-xs text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-semibold">
                    {header.isPlaceholder ? null : (
                      <button className="disabled:cursor-default" onClick={header.column.getToggleSortingHandler()} disabled={!header.column.getCanSort()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/70">
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            )) : <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">{emptyMessage}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
        <span>Page {page} of {Math.max(1, pageCount)} · {pageSize} per page</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange ? onPageChange(page - 1) : updateQuery("page", String(page - 1))}><ChevronLeft /></Button>
          <Button size="sm" variant="outline" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange ? onPageChange(page + 1) : updateQuery("page", String(page + 1))}><ChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}
