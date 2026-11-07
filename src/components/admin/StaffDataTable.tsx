"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";

type StaffRecord = {
  id: string;
  name: string;
  email: string;
  status: string;
  twoFactorEnabled: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: Date | string | null;
  createdAt: Date;
  staffRoles: Array<{ role: { id: string; name: string } }>;
};

const column = createColumnHelper<StaffRecord>();
const columns: ColumnDef<StaffRecord, string>[] = [
  column.accessor((row) => row.name, { id: "name", header: "Name", enableSorting: true }),
  column.accessor((row) => row.email, { id: "email", header: "Email" }),
  column.accessor((row) => row.staffRoles.map(({ role }) => role.name).join(", ") || "No roles", { id: "roles", header: "Roles" }),
  column.accessor((row) => row.status, {
    id: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const val = getValue();
      return <StatusBadge status={val === "ACTIVE" ? "ACTIVE" : "SUSPENDED"} />;
    },
  }),
  column.accessor((row): string => (row.twoFactorEnabled ? "Yes" : "No"), { id: "twoFactorEnabled", header: "TOTP Enrolled" }),
  column.accessor((row): string => (row.mustChangePassword ? "Yes" : "No"), { id: "mustChangePassword", header: "Must Change PW" }),
  column.accessor(
    (row) =>
      row.lastLoginAt
        ? new Date(row.lastLoginAt).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Never",
    { id: "lastLoginAt", header: "Last Login" },
  ),
  column.accessor((row) => new Date(row.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }), { id: "createdAt", header: "Added" }),
];

export function StaffDataTable({ data, page, pageCount, pageSize }: { data: StaffRecord[]; page: number; pageCount: number; pageSize: number }) {
  return <DataTable columns={columns} data={data} page={page} pageCount={pageCount} pageSize={pageSize} />;
}
