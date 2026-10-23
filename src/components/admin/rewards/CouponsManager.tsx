"use client";

import {
  AlertTriangle,
  Clock,
  History,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getCouponRedemptionHistoryAction,
  listCouponsAction,
  revokeCouponAction,
  type AdminCouponRow,
  type CouponRedemptionDetail,
} from "@/server/actions/admin-coupons";

type Props = {
  initialRows: AdminCouponRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialPageCount: number;
  canRevoke: boolean;
};

export function CouponsManager({
  initialRows,
  initialTotal,
  initialPage,
  initialPageSize,
  initialPageCount,
  canRevoke,
}: Props) {
  const [rows, setRows] = useState<AdminCouponRow[]>(initialRows);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [pageCount, setPageCount] = useState<number>(initialPageCount);

  // Filters
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "REDEEMED" | "REVOKED" | "EXPIRED"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"issuedAt" | "expiresAt" | "pointsSpent">("issuedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [isPending, startTransition] = useTransition();

  // Revoke Dialog State
  const [revokingCoupon, setRevokingCoupon] = useState<AdminCouponRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, startRevokeTransition] = useTransition();

  // Redemption History Dialog State
  const [historyCoupon, setHistoryCoupon] = useState<AdminCouponRow | null>(null);
  const [historyList, setHistoryList] = useState<CouponRedemptionDetail[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchCoupons = (targetPage = page, targetPageSize = pageSize) => {
    startTransition(async () => {
      const res = await listCouponsAction({
        page: targetPage,
        pageSize: targetPageSize,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
        sort: sortField,
        direction: sortDirection,
      });

      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        setRows(res.data.rows);
        setTotal(res.data.total);
        setPage(res.data.page);
        setPageSize(res.data.pageSize);
        setPageCount(res.data.pageCount);
      }
    });
  };

  const handleOpenRevoke = (coupon: AdminCouponRow) => {
    if (coupon.isAttachedToPendingBooking) {
      toast.error("This coupon is attached to a booking pending confirmation and cannot be revoked.");
      return;
    }
    setRevokingCoupon(coupon);
    setRevokeReason("");
  };

  const handleConfirmRevoke = () => {
    if (!revokingCoupon) return;
    if (revokeReason.trim().length < 5) {
      toast.error("Revocation reason must be at least 5 characters.");
      return;
    }

    startRevokeTransition(async () => {
      const res = await revokeCouponAction({
        couponId: revokingCoupon.id,
        reason: revokeReason.trim(),
      });

      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        toast.success(res.data.message);
        setRevokingCoupon(null);
        setRevokeReason("");
        fetchCoupons();
      }
    });
  };

  const handleViewHistory = async (coupon: AdminCouponRow) => {
    setHistoryCoupon(coupon);
    setIsLoadingHistory(true);
    try {
      const res = await getCouponRedemptionHistoryAction(coupon.id);
      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        setHistoryList(res.data);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatDiscount = (coupon: AdminCouponRow) => {
    if (coupon.discountType === "PERCENTAGE") {
      const cap = coupon.maxDiscountPaise
        ? ` (Max ₹${Math.round(coupon.maxDiscountPaise / 100)})`
        : "";
      return `${coupon.discountValue}% OFF${cap}`;
    }
    return `₹${Math.round(coupon.discountValue / 100)} OFF`;
  };

  const getStatusBadge = (coupon: AdminCouponRow) => {
    if (coupon.status === "ACTIVE") {
      if (coupon.isExpired) {
        return (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
            EXPIRED
          </span>
        );
      }
      return (
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
          ACTIVE
        </span>
      );
    }
    if (coupon.status === "REDEEMED") {
      return (
        <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
          REDEEMED
        </span>
      );
    }
    if (coupon.status === "REVOKED") {
      return (
        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
          REVOKED
        </span>
      );
    }
    return (
      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
        {coupon.status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-forest-900">Reward Vouchers &amp; Coupons</CardTitle>
              <CardDescription>
                Customer discount coupons generated from reward points. Monitored for redemption and staff revocation.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchCoupons()}
              disabled={isPending}
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${isPending ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {/* Filter Bar */}
          <div className="mt-3 grid gap-2.5 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchCoupons(1)}
                placeholder="Search coupon code or customer..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as "ALL" | "ACTIVE" | "REDEEMED" | "REVOKED" | "EXPIRED",
                );
              }}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Valid)</option>
              <option value="REDEEMED">Redeemed</option>
              <option value="REVOKED">Revoked by Staff</option>
              <option value="EXPIRED">Expired</option>
            </select>

            <select
              value={`${sortField}:${sortDirection}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split(":") as [
                  "issuedAt" | "expiresAt" | "pointsSpent",
                  "asc" | "desc",
                ];
                setSortField(s);
                setSortDirection(d);
              }}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground"
            >
              <option value="issuedAt:desc">Issued (Newest First)</option>
              <option value="issuedAt:asc">Issued (Oldest First)</option>
              <option value="expiresAt:asc">Expiring Soonest</option>
              <option value="pointsSpent:desc">Highest Points</option>
            </select>

            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => fetchCoupons(1)}
              disabled={isPending}
            >
              Apply Filter
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Coupon Code</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Tier &amp; Benefit</th>
                  <th className="p-3 text-right">Points Cost</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Issued</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3 text-center">Redemptions</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isPending && rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                      Loading coupons...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No coupons match the selected filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((coupon) => {
                    const isRevocable =
                      canRevoke &&
                      coupon.status === "ACTIVE" &&
                      !coupon.isExpired &&
                      !coupon.isAttachedToPendingBooking;

                    return (
                      <tr key={coupon.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-bold tracking-wider text-forest-900">
                          {coupon.code}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-foreground">
                            {coupon.customer.name || "Customer"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {coupon.customer.maskedEmail}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{coupon.tier.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDiscount(coupon)}
                          </p>
                        </td>
                        <td className="p-3 text-right font-medium tabular-nums text-forest-900">
                          {coupon.pointsSpent} pts
                        </td>
                        <td className="p-3">{getStatusBadge(coupon)}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(coupon.issuedAt).toLocaleDateString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(coupon.expiresAt).toLocaleDateString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleViewHistory(coupon)}
                            className="inline-flex items-center gap-1 rounded border border-border/80 bg-background px-2 py-0.5 text-[11px] font-semibold text-forest-800 hover:bg-muted"
                            title="View redemption history"
                          >
                            <History className="size-3" />
                            <span>{coupon.redemptionsCount}</span>
                          </button>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {isRevocable ? (
                            <Button
                              size="xs"
                              variant="outline"
                              className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              onClick={() => handleOpenRevoke(coupon)}
                            >
                              <XCircle className="size-3 mr-1" /> Revoke
                            </Button>
                          ) : coupon.isAttachedToPendingBooking ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                              title="Coupon is currently attached to a booking awaiting confirmation"
                            >
                              <Clock className="size-3" /> Booking Pending
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
            <div>
              Showing {rows.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, total)} of {total} coupons
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setPageSize(newSize);
                  fetchCoupons(1, newSize);
                }}
                className="h-7 rounded border border-input bg-transparent px-2 text-xs"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>

              <Button
                size="xs"
                variant="outline"
                onClick={() => fetchCoupons(page - 1)}
                disabled={page <= 1 || isPending}
              >
                Previous
              </Button>
              <span className="font-semibold px-1">
                {page} / {Math.max(1, pageCount)}
              </span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => fetchCoupons(page + 1)}
                disabled={page >= pageCount || isPending}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revoke Coupon Modal */}
      <Dialog
        open={Boolean(revokingCoupon)}
        onOpenChange={(open) => !open && setRevokingCoupon(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-4" /> Revoke Coupon Voucher
            </DialogTitle>
            <DialogDescription>
              Revoking a coupon marks it as invalid immediately. Points are NOT automatically
              refunded. This action is permanently audited.
            </DialogDescription>
          </DialogHeader>

          {revokingCoupon && (
            <div className="space-y-3 py-2">
              <div className="rounded border bg-muted/40 p-2.5 text-xs space-y-1">
                <p>
                  <strong>Code:</strong>{" "}
                  <span className="font-mono font-bold">{revokingCoupon.code}</span>
                </p>
                <p>
                  <strong>Customer:</strong> {revokingCoupon.customer.name} (
                  {revokingCoupon.customer.maskedEmail})
                </p>
                <p>
                  <strong>Points Spent:</strong> {revokingCoupon.pointsSpent} pts
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Mandatory Revocation Reason <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Explain why this coupon is being revoked..."
                  className="mt-1 text-xs resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevokingCoupon(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={isRevoking || revokeReason.trim().length < 5}
            >
              {isRevoking ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" /> Revoking...
                </>
              ) : (
                "Confirm Revoke"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redemption History Dialog */}
      <Dialog
        open={Boolean(historyCoupon)}
        onOpenChange={(open) => !open && setHistoryCoupon(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-forest-900 flex items-center gap-1.5">
              <History className="size-4 text-forest-700" /> Voucher Redemption History
            </DialogTitle>
            <DialogDescription>
              {historyCoupon ? (
                <span>
                  Redemption record for code{" "}
                  <strong className="font-mono text-foreground">{historyCoupon.code}</strong> (
                  {historyCoupon.customer.maskedEmail})
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                Loading redemption details...
              </div>
            ) : historyList.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                This coupon has not been applied to any completed or pending bookings yet.
              </div>
            ) : (
              <div className="divide-y divide-border/60 rounded-md border border-border/80">
                {historyList.map((redemption) => (
                  <div key={redemption.id} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Booking: {redemption.bookingReference || redemption.bookingId}
                      </span>
                      <span className="font-bold text-forest-900 tabular-nums">
                        -₹{Math.round(redemption.discountPaise / 100)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Status: {redemption.bookingStatus}</span>
                      <time dateTime={redemption.redeemedAt}>
                        Redeemed:{" "}
                        {new Date(redemption.redeemedAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </time>
                    </div>
                    {redemption.releasedAt && (
                      <div className="mt-1 rounded bg-muted/60 p-1.5 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-amber-800">Released:</span>{" "}
                        {new Date(redemption.releasedAt).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        · Reason: {redemption.releaseReason || "Booking cancelled"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHistoryCoupon(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
