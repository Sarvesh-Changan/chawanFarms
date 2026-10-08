import { createColumnHelper } from "@tanstack/react-table";
import { z } from "zod";

import { DataTable } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { listAudit } from "@/server/services/admin-dashboard";
import { redactSensitive } from "@/server/services/audit-redaction";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), action: z.string().trim().max(100).optional(), entityType: z.string().trim().max(80).optional(), actorId: z.string().uuid().optional(), sort: z.enum(["createdAt", "action"]).default("createdAt"), direction: z.enum(["asc", "desc"]).default("desc") }).passthrough();
type AuditRow = { id: string; actorId: string | null; actorType: string; action: string; entityType: string | null; entityId: string | null; before: unknown; after: unknown; ip: string | null; requestId: string | null; createdAt: Date };
const column = createColumnHelper<AuditRow>();
const columns = [
  column.accessor((row) => row.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), { id: "createdAt", header: "When", enableSorting: true }),
  column.accessor((row) => row.action, { id: "action", header: "Action", enableSorting: true }),
  column.accessor((row) => row.entityType ? `${row.entityType}${row.entityId ? ` · ${row.entityId}` : ""}` : "—", { id: "entity", header: "Entity" }),
  column.accessor((row) => row.actorId ? `${row.actorType} · ${row.actorId}` : row.actorType, { id: "actor", header: "Actor" }),
  column.accessor((row) => JSON.stringify(redactSensitive(row.before)) ?? "—", { id: "before", header: "Before", cell: ({ getValue }) => <span className="block max-w-56 truncate font-mono text-xs" title={getValue()}>{getValue()}</span> }),
  column.accessor((row) => JSON.stringify(redactSensitive(row.after)) ?? "—", { id: "after", header: "After", cell: ({ getValue }) => <span className="block max-w-56 truncate font-mono text-xs" title={getValue()}>{getValue()}</span> }),
  column.accessor((row) => row.requestId ?? "—", { id: "requestId", header: "Request ID", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span> }),
];

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/security/audit">) {
  const session = await getSession();
  const actor = session ? await getStaffPrincipal(session.user.id) : null;
  if (!actor || !(await can(actor, "audit.read"))) return <NoAccess title={actor && !actor.twoFactorEnabled ? "Set up two-factor authentication" : "Audit access required"} />;
  const query = querySchema.parse(await searchParams);
  const result = await listAudit(query.page, 50, { action: query.action, entityType: query.entityType, actorId: query.actorId }, query.sort, query.direction);
  return <div className="space-y-6"><PageHeader eyebrow="Access management" title="Audit log" description="Append-only records of staff actions. Sensitive fields are redacted before display." /><FilterBar fields={[{ name: "action", label: "Action", placeholder: "staff.invite.create" }, { name: "entityType", label: "Entity type", placeholder: "User" }, { name: "actorId", label: "Actor ID", placeholder: "UUID" }]} /><p className="text-sm text-muted-foreground">{result.total} matching events</p><DataTable columns={columns} data={result.rows} page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} emptyMessage="No audit events match these filters." /></div>;
}
