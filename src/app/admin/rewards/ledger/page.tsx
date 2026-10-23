import type { Metadata } from "next";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { PointsLedgerTable } from "@/components/admin/rewards/PointsLedgerTable";
import { listPendingAdjustmentsAction } from "@/server/actions/admin-adjustments";
import { getPointsLedgerAction } from "@/server/actions/admin-reward-ledger";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requirePermission } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Points Movement Ledger · Chawan Farms Admin",
};

export default async function RewardsLedgerPage() {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff) {
    return (
      <NoAccess
        title="Staff access required"
        message="The admin workspace is available to invited staff accounts."
      />
    );
  }

  try {
    await requirePermission("rewards.ledger.read");
  } catch {
    return (
      <NoAccess
        title="Ledger access required"
        message="Your staff role does not have permission to view the reward points ledger."
      />
    );
  }

  const [canAdjust, canApprove, canExport] = await Promise.all([
    can(staff, "rewards.adjust"),
    can(staff, "rewards.adjust.approve"),
    can(staff, "rewards.ledger.export"),
  ]);

  const [ledgerRes, pendingRes] = await Promise.all([
    getPointsLedgerAction({ page: 1, pageSize: 25, sort: "createdAt", direction: "desc" }),
    canAdjust || canApprove
      ? listPendingAdjustmentsAction()
      : Promise.resolve({ ok: true as const, data: [] as import("@/server/actions/admin-adjustments").PendingAdjustmentItem[] }),
  ]);

  const initialRows = ledgerRes.ok ? ledgerRes.data.rows : [];
  const initialTotal = ledgerRes.ok ? ledgerRes.data.total : 0;
  const initialPage = ledgerRes.ok ? ledgerRes.data.page : 1;
  const initialPageSize = ledgerRes.ok ? ledgerRes.data.pageSize : 25;
  const initialPageCount = ledgerRes.ok ? ledgerRes.data.pageCount : 1;
  const initialPendingRequests = pendingRes.ok ? pendingRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rewards & Loyalty"
        title="Points Movement Ledger"
        description="Immutable record of reward points earned, redeemed, expired, reversed, or manually adjusted."
      />

      <PointsLedgerTable
        initialRows={initialRows}
        initialTotal={initialTotal}
        initialPage={initialPage}
        initialPageSize={initialPageSize}
        initialPageCount={initialPageCount}
        initialPendingRequests={initialPendingRequests}
        canAdjust={canAdjust}
        canApprove={canApprove}
        canExport={canExport}
      />
    </div>
  );
}
