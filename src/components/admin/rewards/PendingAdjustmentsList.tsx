"use client";

import { AlertCircle, Check, Clock, Loader2, ShieldAlert, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  approveAdjustmentAction,
  rejectAdjustmentAction,
  type PendingAdjustmentItem,
} from "@/server/actions/admin-adjustments";

type Props = {
  requests: PendingAdjustmentItem[];
  canApprovePermission: boolean;
  onRefresh?: () => void;
};

export function PendingAdjustmentsList({ requests, canApprovePermission, onRefresh }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rejectingRequest, setRejectingRequest] = useState<PendingAdjustmentItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = (req: PendingAdjustmentItem) => {
    if (!req.canApprove) {
      toast.error("You cannot approve your own adjustment request.");
      return;
    }

    startTransition(async () => {
      const clientKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `app_${Date.now()}`;
      const res = await approveAdjustmentAction({
        requestId: req.id,
        clientKey,
      });

      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        toast.success(res.data.message);
        onRefresh?.();
      }
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectingRequest) return;
    if (rejectionReason.trim().length < 3) {
      toast.error("Rejection reason must be at least 3 characters.");
      return;
    }

    startTransition(async () => {
      const res = await rejectAdjustmentAction({
        requestId: rejectingRequest.id,
        reason: rejectionReason.trim(),
      });

      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        toast.success(res.data.message);
        setRejectingRequest(null);
        setRejectionReason("");
        onRefresh?.();
      }
    });
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-700" />
              <CardTitle className="text-sm font-bold text-amber-950">
                Pending Points Adjustments ({requests.length})
              </CardTitle>
            </div>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Dual-Staff Authorization
            </span>
          </div>
          <CardDescription className="text-xs text-amber-900/80">
            Adjustments exceeding the single-staff threshold require approval by an independent staff member.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="divide-y divide-amber-200/70 rounded-md border border-amber-200/80 bg-background/80">
            {requests.map((req) => {
              const isPositive = req.points > 0;
              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {req.customerName || "Customer"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({req.customerMaskedEmail})
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isPositive ? `+${req.points}` : req.points} pts
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      &quot;{req.reason}&quot;
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Requested by: <strong>{req.requestedByName || "Staff"}</strong></span>
                      <span>·</span>
                      <time dateTime={req.createdAt}>
                        {new Date(req.createdAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {!req.canApprove ? (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100/70 px-2 py-1 rounded">
                        <ShieldAlert className="size-3.5 shrink-0" />
                        <span>Self-approval forbidden</span>
                      </div>
                    ) : canApprovePermission ? (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                          disabled={isPending}
                          onClick={() => {
                            setRejectingRequest(req);
                            setRejectionReason("");
                          }}
                        >
                          <X className="size-3 mr-1" /> Reject
                        </Button>
                        <Button
                          size="xs"
                          className="bg-forest-900 text-white hover:bg-forest-800"
                          disabled={isPending}
                          onClick={() => handleApprove(req)}
                        >
                          {isPending ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <Check className="size-3 mr-1" />
                          )}
                          Approve
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">
                        Requires approval permission
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Reject Confirmation Dialog */}
      <Dialog
        open={Boolean(rejectingRequest)}
        onOpenChange={(open) => !open && setRejectingRequest(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-1.5">
              <AlertCircle className="size-4" /> Reject Points Adjustment
            </DialogTitle>
            <DialogDescription>
              Provide a mandatory reason for rejecting this points adjustment request.
            </DialogDescription>
          </DialogHeader>

          {rejectingRequest && (
            <div className="space-y-3 py-2">
              <div className="rounded border bg-muted/40 p-2.5 text-xs space-y-1">
                <p>
                  <strong>Customer:</strong> {rejectingRequest.customerName} ({rejectingRequest.customerMaskedEmail})
                </p>
                <p>
                  <strong>Points:</strong> {rejectingRequest.points} pts
                </p>
                <p>
                  <strong>Request Reason:</strong> {rejectingRequest.reason}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Rejection Reason <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request is being rejected..."
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
              onClick={() => setRejectingRequest(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isPending || rejectionReason.trim().length < 3}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" /> Rejecting...
                </>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
