"use client";

import {
  Download,
  Filter,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Ticket,
  Video,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ManualAdjustmentDialog } from "@/components/admin/rewards/ManualAdjustmentDialog";
import { PendingAdjustmentsList } from "@/components/admin/rewards/PendingAdjustmentsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listPendingAdjustmentsAction,
  type PendingAdjustmentItem,
} from "@/server/actions/admin-adjustments";
import {
  exportPointsLedgerAction,
  getPointsLedgerAction,
  type LedgerFilterInput,
  type PointsLedgerRow,
} from "@/server/actions/admin-reward-ledger";

type Props = {
  initialRows: PointsLedgerRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialPageCount: number;
  initialPendingRequests: PendingAdjustmentItem[];
  canAdjust: boolean;
  canApprove: boolean;
  canExport: boolean;
};

export function PointsLedgerTable({
  initialRows,
  initialTotal,
  initialPage,
  initialPageSize,
  initialPageCount,
  initialPendingRequests,
  canAdjust,
  canApprove,
  canExport,
}: Props) {
  const [rows, setRows] = useState<PointsLedgerRow[]>(initialRows);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [pageCount, setPageCount] = useState<number>(initialPageCount);
  const [pendingRequests, setPendingRequests] = useState<PendingAdjustmentItem[]>(initialPendingRequests);

  // Filters state
  const [filterType, setFilterType] = useState<LedgerFilterInput["type"]>("ALL");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [ruleVersion, setRuleVersion] = useState<string>("");
  const [sortField, setSortField] = useState<LedgerFilterInput["sort"]>("createdAt");
  const [sortDirection, setSortDirection] = useState<LedgerFilterInput["direction"]>("desc");

  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState<boolean>(false);

  const fetchLedger = (targetPage = page, targetPageSize = pageSize) => {
    startTransition(async () => {
      const res = await getPointsLedgerAction({
        page: targetPage,
        pageSize: targetPageSize,
        type: filterType,
        customerSearch: customerSearch.trim() || undefined,
        ruleVersion: ruleVersion ? parseInt(ruleVersion, 10) : undefined,
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

  const refreshPending = async () => {
    const res = await listPendingAdjustmentsAction();
    if (res.ok) {
      setPendingRequests(res.data);
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      toast.error("You do not have permission to export ledger data.");
      return;
    }

    setIsExporting(true);
    try {
      const res = await exportPointsLedgerAction({
        type: filterType,
        customerSearch: customerSearch.trim() || undefined,
        ruleVersion: ruleVersion ? parseInt(ruleVersion, 10) : undefined,
      });

      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        const { csvContent, filename, rowCount } = res.data;
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${rowCount} ledger entries to ${filename}`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const getTypeBadge = (type: PointsLedgerRow["type"]) => {
    switch (type) {
      case "EARN":
        return <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">EARN</span>;
      case "REDEEM":
        return <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">REDEEM</span>;
      case "ADJUST":
        return <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">ADJUST</span>;
      case "EXPIRE":
        return <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">EXPIRE</span>;
      case "REVERSE":
        return <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">REVERSE</span>;
      default:
        return <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Adjustments Panel (Dual authorization) */}
      <PendingAdjustmentsList
        requests={pendingRequests}
        canApprovePermission={canApprove}
        onRefresh={() => {
          refreshPending();
          fetchLedger(1);
        }}
      />

      {/* Main Ledger Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-forest-900">Points Movement Ledger</CardTitle>
              <CardDescription>
                Audited ledger of all customer reward transactions, redemptions, and manual adjustments.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canAdjust && (
                <Button
                  size="sm"
                  className="bg-forest-900 text-white hover:bg-forest-800"
                  onClick={() => setIsAdjustmentOpen(true)}
                >
                  <PlusCircle className="size-4 mr-1.5" /> Adjust Points
                </Button>
              )}
              {canExport && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Download className="size-3.5 mr-1.5" />
                  )}
                  Export CSV
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fetchLedger()}
                disabled={isPending}
              >
                <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-3 grid gap-2.5 pt-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLedger(1)}
                placeholder="Search customer name / email..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as LedgerFilterInput["type"]);
              }}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground"
            >
              <option value="ALL">All Types</option>
              <option value="EARN">Earned (Video approval)</option>
              <option value="REDEEM">Redeemed (Coupon create)</option>
              <option value="ADJUST">Manual Adjustment</option>
              <option value="EXPIRE">Expired</option>
              <option value="REVERSE">Reversed</option>
            </select>

            <Input
              type="number"
              value={ruleVersion}
              onChange={(e) => setRuleVersion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLedger(1)}
              placeholder="Filter Rule Version (e.g. 1)"
              className="h-8 text-xs"
            />

            <select
              value={`${sortField}:${sortDirection}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split(":") as [
                  LedgerFilterInput["sort"],
                  LedgerFilterInput["direction"],
                ];
                setSortField(s);
                setSortDirection(d);
              }}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground"
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="points:desc">Highest Points</option>
              <option value="points:asc">Lowest Points</option>
            </select>

            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => fetchLedger(1)}
              disabled={isPending}
            >
              <Filter className="size-3 mr-1" /> Apply Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Date (IST)</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Points</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Rule</th>
                  <th className="p-3">Staff Actor</th>
                  <th className="p-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isPending && rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                      Loading ledger entries...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No points transactions match the current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isPositive = row.points > 0;
                    return (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-foreground">{row.customer.name || "Customer"}</p>
                          <p className="text-[11px] text-muted-foreground">{row.customer.maskedEmail}</p>
                        </td>
                        <td className="p-3">{getTypeBadge(row.type)}</td>
                        <td className="p-3 text-right font-semibold tabular-nums">
                          <span className={isPositive ? "text-emerald-700" : "text-amber-800"}>
                            {isPositive ? `+${row.points}` : row.points}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium tabular-nums text-forest-900">
                          {row.balanceAfter}
                        </td>
                        <td className="p-3 max-w-xs truncate text-muted-foreground" title={row.reason ?? ""}>
                          {row.reason || "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {row.ruleVersion ? `v${row.ruleVersion}` : "—"}
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{row.actor.name || "System"}</p>
                          {row.secondApprover.name && (
                            <p className="text-[10px] text-muted-foreground">
                              Appr: {row.secondApprover.name}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          {row.videoSubmissionId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-forest-800 bg-forest-50 px-1.5 py-0.5 rounded">
                              <Video className="size-3" /> Video
                            </span>
                          ) : row.couponId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded">
                              <Ticket className="size-3" /> Voucher
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
              {Math.min(page * pageSize, total)} of {total} entries
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setPageSize(newSize);
                  fetchLedger(1, newSize);
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
                onClick={() => fetchLedger(page - 1)}
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
                onClick={() => fetchLedger(page + 1)}
                disabled={page >= pageCount || isPending}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Adjustment Dialog */}
      <ManualAdjustmentDialog
        open={isAdjustmentOpen}
        onOpenChange={setIsAdjustmentOpen}
        onSuccess={() => {
          fetchLedger(1);
          refreshPending();
        }}
      />
    </div>
  );
}
