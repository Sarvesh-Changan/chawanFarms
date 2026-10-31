"use client";

import { createColumnHelper } from "@tanstack/react-table";

import { DataTable } from "@/components/admin/DataTable";

type AuditDisplayRow = {
  id: string;
  when: string;
  action: string;
  entity: string;
  actor: string;
  before: string;
  after: string;
  requestId: string;
};

const column = createColumnHelper<AuditDisplayRow>();
const columns = [
  column.accessor("when", { header: "When", enableSorting: true }),
  column.accessor("action", { header: "Action", enableSorting: true }),
  column.accessor("entity", { header: "Entity" }),
  column.accessor("actor", { header: "Actor" }),
  column.accessor("before", { header: "Before", cell: ({ getValue }) => <span className="block max-w-56 truncate font-mono text-xs" title={getValue()}>{getValue()}</span> }),
  column.accessor("after", { header: "After", cell: ({ getValue }) => <span className="block max-w-56 truncate font-mono text-xs" title={getValue()}>{getValue()}</span> }),
  column.accessor("requestId", { header: "Request ID", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span> }),
];

export function AuditDataTable({ data, page, pageCount, pageSize, emptyMessage }: { data: AuditDisplayRow[]; page: number; pageCount: number; pageSize: number; emptyMessage: string }) {
  return <DataTable columns={columns} data={data} page={page} pageCount={pageCount} pageSize={pageSize} emptyMessage={emptyMessage} />;
}
