import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: number | string;
  detail?: string;
  trend?: "up" | "down" | "flat";
};

export function StatCard({ label, value, detail, trend }: StatCardProps) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <Card className="min-h-32 border-forest-900/10 bg-card">
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums text-forest-900">{value}</CardTitle>
      </CardHeader>
      {detail || trend ? (
        <CardContent className="flex items-center gap-1 text-xs text-muted-foreground">
          {trend ? <TrendIcon aria-hidden className="size-3.5" /> : null}
          {detail ?? ""}
        </CardContent>
      ) : null}
    </Card>
  );
}
