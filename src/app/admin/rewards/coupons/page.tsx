import type { Metadata } from "next";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { CouponsManager } from "@/components/admin/rewards/CouponsManager";
import { listCouponsAction } from "@/server/actions/admin-coupons";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requirePermission } from "@/server/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reward Coupons & Vouchers · Chawan Farms Admin",
};

export default async function RewardsCouponsPage() {
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
    await requirePermission("coupons.read");
  } catch {
    return (
      <NoAccess
        title="Coupons access required"
        message="Your staff role does not have permission to view reward coupons."
      />
    );
  }

  const canRevoke = await can(staff, "coupons.revoke");

  const couponsRes = await listCouponsAction({
    page: 1,
    pageSize: 25,
    status: "ALL",
    sort: "issuedAt",
    direction: "desc",
  });

  const initialRows = couponsRes.ok ? couponsRes.data.rows : [];
  const initialTotal = couponsRes.ok ? couponsRes.data.total : 0;
  const initialPage = couponsRes.ok ? couponsRes.data.page : 1;
  const initialPageSize = couponsRes.ok ? couponsRes.data.pageSize : 25;
  const initialPageCount = couponsRes.ok ? couponsRes.data.pageCount : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rewards & Loyalty"
        title="Reward Vouchers &amp; Coupons"
        description="Customer voucher codes generated from redeemed loyalty points. Track redemptions, release history, and staff revocations."
      />

      <CouponsManager
        initialRows={initialRows}
        initialTotal={initialTotal}
        initialPage={initialPage}
        initialPageSize={initialPageSize}
        initialPageCount={initialPageCount}
        canRevoke={canRevoke}
      />
    </div>
  );
}
