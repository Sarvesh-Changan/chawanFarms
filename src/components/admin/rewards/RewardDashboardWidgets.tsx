"use client";

import { Award, CheckCircle2, Clock, HelpCircle, RefreshCw, Ticket, TrendingDown, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRewardDashboardMetricsAction } from "@/server/actions/admin-rewards";
import type { RewardDashboardMetrics } from "@/server/services/admin-dashboard";

type Props = {
  initialMetrics: RewardDashboardMetrics;
};

export function RewardDashboardWidgets({ initialMetrics }: Props) {
  const [metrics, setMetrics] = useState<RewardDashboardMetrics>(initialMetrics);
  const [days, setDays] = useState<number>(initialMetrics.rangeDays);
  const [isPending, startTransition] = useTransition();

  const handleRangeChange = (newDays: number) => {
    setDays(newDays);
    startTransition(async () => {
      const res = await getRewardDashboardMetricsAction(newDays);
      if (res.ok) {
        setMetrics(res.data);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-forest-900">
            Rewards & Loyalty Overview
          </h3>
          <p className="text-xs text-muted-foreground">
            Aggregate points movement, active vouchers, and voucher redemption rates.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 p-1 text-xs">
          <span className="px-2 font-medium text-muted-foreground">Window:</span>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleRangeChange(d)}
              disabled={isPending}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                days === d
                  ? "bg-forest-900 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {d} days
            </button>
          ))}
          {isPending && <RefreshCw className="size-3.5 animate-spin text-muted-foreground ml-1" />}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Points Issued */}
        <Card className="border-forest-900/10 bg-card">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-1.5 font-medium">
                <TrendingUp className="size-4 text-emerald-600" />
                Points Issued
              </CardDescription>
              <span className="text-xs text-muted-foreground" title="Earned from videos or positive staff adjustments">
                +{days}d
              </span>
            </div>
            <CardTitle className="text-2xl tabular-nums text-forest-900">
              {metrics.pointsIssued.toLocaleString("en-IN")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            From video approvals & manual credits
          </CardContent>
        </Card>

        {/* Points Redeemed */}
        <Card className="border-forest-900/10 bg-card">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-1.5 font-medium">
                <TrendingDown className="size-4 text-amber-600" />
                Points Redeemed
              </CardDescription>
              <span className="text-xs text-muted-foreground" title="Converted to coupon discounts">
                -{days}d
              </span>
            </div>
            <CardTitle className="text-2xl tabular-nums text-forest-900">
              {metrics.pointsRedeemed.toLocaleString("en-IN")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Points deducted for voucher creation
          </CardContent>
        </Card>

        {/* Active Coupons */}
        <Card className="border-forest-900/10 bg-card">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-1.5 font-medium">
                <Ticket className="size-4 text-sky-600" />
                Active Coupons
              </CardDescription>
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                Live
              </span>
            </div>
            <CardTitle className="text-2xl tabular-nums text-forest-900">
              {metrics.activeCoupons.toLocaleString("en-IN")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Unexpired vouchers ready for checkout
          </CardContent>
        </Card>

        {/* Redemption Rate */}
        <Card className="border-forest-900/10 bg-card">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-4 text-forest-700" />
                Redemption Rate
              </CardDescription>
              <span
                className="cursor-help text-xs text-muted-foreground"
                title={`Vouchers redeemed (${metrics.couponsRedeemedInRange}) / Vouchers issued (${metrics.couponsIssuedInRange}) in the selected ${days}-day window`}
              >
                <HelpCircle className="size-3.5" />
              </span>
            </div>
            <CardTitle className="text-2xl tabular-nums text-forest-900">
              {metrics.redemptionRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {metrics.couponsRedeemedInRange} of {metrics.couponsIssuedInRange} vouchers used ({days}d window)
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns: Expired vs Reversed Points */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <span className="font-semibold text-foreground">Points Expired</span>
              <p className="text-[11px] text-muted-foreground">Lapsed past rule expiration validity</p>
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {metrics.pointsExpired.toLocaleString("en-IN")} pts
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-muted-foreground" />
            <div>
              <span className="font-semibold text-foreground">Points Reversed</span>
              <p className="text-[11px] text-muted-foreground">Rolled back from booking cancellations or audits</p>
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {metrics.pointsReversed.toLocaleString("en-IN")} pts
          </span>
        </div>
      </div>
    </div>
  );
}
