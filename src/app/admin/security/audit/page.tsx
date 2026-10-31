import { z } from "zod";

import { AuditDataTable } from "@/components/admin/AuditDataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { listAudit } from "@/server/services/admin-dashboard";
import { redactSensitive } from "@/server/services/audit-redaction";

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    action: z.string().trim().max(100).optional(),
    entityType: z.string().trim().max(80).optional(),
    actorId: z.string().uuid().optional(),
    sort: z.enum(["createdAt", "action"]).default("createdAt"),
    direction: z.enum(["asc", "desc"]).default("desc"),
  })
  .passthrough();
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const actor = session ? await getStaffPrincipal(session.user.id) : null;
  if (!actor || !(await can(actor, "audit.read")))
    return <NoAccess title="Audit access required" />;
  const query = querySchema.parse(await searchParams);
  const result = await listAudit(
    query.page,
    50,
    {
      action: query.action,
      entityType: query.entityType,
      actorId: query.actorId,
    },
    query.sort,
    query.direction,
  );
  const rows = result.rows.map((row) => ({
    id: row.id,
    when: row.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    action: row.action,
    entity: row.entityType
      ? `${row.entityType}${row.entityId ? ` · ${row.entityId}` : ""}`
      : "—",
    actor: row.actorId ? `${row.actorType} · ${row.actorId}` : row.actorType,
    before: JSON.stringify(redactSensitive(row.before)) ?? "—",
    after: JSON.stringify(redactSensitive(row.after)) ?? "—",
    requestId: row.requestId ?? "—",
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access management"
        title="Audit log"
        description="Append-only records of staff actions. Sensitive fields are redacted before display."
      />
      <FilterBar
        fields={[
          {
            name: "action",
            label: "Action",
            placeholder: "staff.invite.create",
          },
          { name: "entityType", label: "Entity type", placeholder: "User" },
          { name: "actorId", label: "Actor ID", placeholder: "UUID" },
        ]}
      />
      <p className="text-muted-foreground text-sm">
        {result.total} matching events
      </p>
      <AuditDataTable
        data={rows}
        page={result.page}
        pageCount={result.pageCount}
        pageSize={result.pageSize}
        emptyMessage="No audit events match these filters."
      />
    </div>
  );
}
