"use client";

import { createColumnHelper } from "@tanstack/react-table";

import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";

type StaffRecord = {
  id: string;
  name: string;
  email: string;
  status: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
  staffRoles: Array<{ role: { id: string; name: string } }>;
};

const column = createColumnHelper<StaffRecord>();
const columns = [
  column.accessor((row) => row.name, { id: "name", header: "Name", enableSorting: true }),
  column.accessor((row) => row.email, { id: "email", header: "Email" }),
  column.accessor((row) => row.staffRoles.map(({ role }) => role.name).join(", ") || "No roles", { id: "roles", header: "Roles" }),
  column.accessor((row) => row.status, { id: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue()} /> }),
  column.accessor((row) => String(row.twoFactorEnabled ? "Enabled" : "Not enabled"), { id: "twoFactorEnabled", header: "Two-factor" }),
  column.accessor((row) => row.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }), { id: "createdAt", header: "Added" }),
];

export function StaffDataTable({ data, page, pageCount, pageSize }: { data: StaffRecord[]; page: number; pageCount: number; pageSize: number }) {
  return <DataTable columns={columns} data={data} page={page} pageCount={pageCount} pageSize={pageSize} />;
}
