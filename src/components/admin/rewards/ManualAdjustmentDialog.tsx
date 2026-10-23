"use client";

import { AlertTriangle, Info, Loader2, Search, UserCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  getCustomerAdjustmentCapsAction,
  requestPointsAdjustmentAction,
  searchCustomersForAdjustmentAction,
  type CustomerSearchResult,
} from "@/server/actions/admin-adjustments";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ManualAdjustmentDialog({ open, onOpenChange, onSuccess }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

  const [caps, setCaps] = useState<{
    currentBalance: number;
    manualAdjustMaxPoints: number;
    manualAdjustApprovalThreshold: number;
    maxPointsPerCustomer: number | null;
    isOwnAccount: boolean;
  } | null>(null);
  const [isLoadingCaps, setIsLoadingCaps] = useState(false);

  const [pointsInput, setPointsInput] = useState<string>("");
  const [reasonInput, setReasonInput] = useState<string>("");
  const [isSubmitting, startTransition] = useTransition();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedCustomer(null);
      setCaps(null);
      setPointsInput("");
      setReasonInput("");
    }
    onOpenChange(nextOpen);
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 3) {
      toast.error("Please enter at least 3 characters to search");
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchCustomersForAdjustmentAction({ query: searchQuery });
      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        setSearchResults(res.data);
        if (res.data.length === 0) {
          toast.info("No matching customers found.");
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCustomer = async (cust: CustomerSearchResult) => {
    if (cust.isSelf) {
      toast.error("You cannot adjust points on your own customer account.");
      return;
    }
    setSelectedCustomer(cust);
    setIsLoadingCaps(true);
    try {
      const res = await getCustomerAdjustmentCapsAction(cust.id);
      if (!res.ok) {
        toast.error(res.error.message);
        setSelectedCustomer(null);
      } else {
        setCaps(res.data);
      }
    } finally {
      setIsLoadingCaps(false);
    }
  };

  const pointsNum = parseInt(pointsInput, 10) || 0;
  const isPendingApproval =
    caps && caps.manualAdjustApprovalThreshold > 0 && Math.abs(pointsNum) > caps.manualAdjustApprovalThreshold;

  const resultingBalance = caps ? caps.currentBalance + pointsNum : 0;
  const wouldBeNegative = resultingBalance < 0;
  const exceedsMaxCap =
    caps && caps.manualAdjustMaxPoints > 0 && Math.abs(pointsNum) > caps.manualAdjustMaxPoints;

  const canSubmit =
    selectedCustomer &&
    caps &&
    !caps.isOwnAccount &&
    pointsNum !== 0 &&
    !wouldBeNegative &&
    !exceedsMaxCap &&
    reasonInput.trim().length >= 5 &&
    !isSubmitting;

  const handleSubmit = () => {
    if (!selectedCustomer || !canSubmit) return;

    startTransition(async () => {
      const clientKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `adj_${Date.now()}_${Math.random()}`;
      const res = await requestPointsAdjustmentAction({
        userId: selectedCustomer.id,
        points: pointsNum,
        reason: reasonInput.trim(),
        clientKey,
      });

      if (!res.ok) {
        toast.error(res.error.message);
      } else {
        toast.success(res.data.message);
        handleOpenChange(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-forest-900">Manual Points Adjustment</DialogTitle>
          <DialogDescription>
            Credit or deduct reward points on a customer account. Governed by active rule thresholds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Search Customer */}
          {!selectedCustomer ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground">
                Search Customer (by Name or Email)
              </label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Min 3 characters..."
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSearch}
                  disabled={isSearching || searchQuery.trim().length < 3}
                >
                  {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>

              {/* Results list */}
              {searchResults.length > 0 && (
                <div className="max-h-56 divide-y divide-border/60 overflow-y-auto rounded-md border border-border/70 bg-muted/20">
                  {searchResults.map((cust) => (
                    <div
                      key={cust.id}
                      className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                        cust.isSelf
                          ? "bg-muted/50 opacity-60 cursor-not-allowed"
                          : "hover:bg-muted/80 cursor-pointer"
                      }`}
                      onClick={() => !cust.isSelf && handleSelectCustomer(cust)}
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {cust.name || "Customer"}{" "}
                          {cust.isSelf && (
                            <span className="ml-1 text-[10px] text-destructive font-normal">
                              (Your Account - Forbidden)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{cust.maskedEmail}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-forest-900 tabular-nums">
                          {cust.currentBalance} pts
                        </span>
                        {!cust.isSelf && (
                          <Button size="xs" variant="ghost" className="block text-[11px] text-forest-700">
                            Select
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Customer Selected */
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-forest-900/15 bg-forest-50/50 p-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-forest-700" />
                  <div>
                    <p className="text-xs font-bold text-forest-900">
                      {selectedCustomer.name || "Customer"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedCustomer.maskedEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                      Balance
                    </span>
                    <span className="text-sm font-bold text-forest-900 tabular-nums">
                      {caps ? caps.currentBalance : "..."} pts
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCaps(null);
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>

              {isLoadingCaps ? (
                <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin mr-2" /> Loading active rule caps...
                </div>
              ) : caps ? (
                <div className="space-y-3">
                  {/* Rule thresholds banner */}
                  <div className="rounded-md border border-border/80 bg-muted/30 p-2.5 text-[11px] text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Max adjustment cap:</span>
                      <span className="font-semibold text-foreground">
                        {caps.manualAdjustMaxPoints ? `±${caps.manualAdjustMaxPoints} pts` : "Unlimited"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Two-person approval threshold:</span>
                      <span className="font-semibold text-foreground">
                        &gt; {caps.manualAdjustApprovalThreshold} pts
                      </span>
                    </div>
                  </div>

                  {/* Points Input */}
                  <div>
                    <label className="text-xs font-semibold text-foreground flex justify-between">
                      <span>Adjustment Points (use &apos;-&apos; to deduct)</span>
                      {pointsNum !== 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          Resulting: <strong className="text-foreground tabular-nums">{resultingBalance} pts</strong>
                        </span>
                      )}
                    </label>
                    <Input
                      type="number"
                      value={pointsInput}
                      onChange={(e) => setPointsInput(e.target.value)}
                      placeholder="e.g. +50 or -30"
                      className="mt-1 h-9 text-xs tabular-nums"
                    />
                    {wouldBeNegative && (
                      <p className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Resulting balance cannot fall below 0.
                      </p>
                    )}
                    {exceedsMaxCap && (
                      <p className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Exceeds max allowed adjustment cap ({caps.manualAdjustMaxPoints} pts).
                      </p>
                    )}
                    {isPendingApproval && !wouldBeNegative && !exceedsMaxCap && (
                      <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex items-start gap-1.5">
                        <Info className="size-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>Requires Second Approval:</strong> Adjustment exceeds {caps.manualAdjustApprovalThreshold} pts. A pending request will be created requiring another staff member to approve.
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Reason Textarea */}
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Reason for Adjustment <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      value={reasonInput}
                      onChange={(e) => setReasonInput(e.target.value)}
                      placeholder="Mandatory plain-text explanation (min 5 characters)..."
                      className="mt-1 text-xs resize-none"
                      rows={3}
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      This reason is recorded in the immutable audit log and customer ledger.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          {selectedCustomer && (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-forest-900 text-white hover:bg-forest-800"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" /> Submitting...
                </>
              ) : isPendingApproval ? (
                "Submit for Approval"
              ) : (
                "Apply Adjustment"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
