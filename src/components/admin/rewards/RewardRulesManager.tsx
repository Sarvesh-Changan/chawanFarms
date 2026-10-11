"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Copy, Plus, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RewardRuleInput, RewardTierInput } from "@/lib/schemas/reward-rules";
import {
  activateRewardRuleAction,
  getRuleImpactSummaryAction,
  loadProvisionalDefaultsAction,
  saveRewardRuleVersionAction,
} from "@/server/actions/admin-rewards";
import type { RewardRuleWithTiers, RuleImpactSummary } from "@/server/services/admin-rewards";

type RewardRulesManagerProps = {
  versions: RewardRuleWithTiers[];
  activeRule: RewardRuleWithTiers | null;
  latestRule: RewardRuleWithTiers | null;
  editableDraft: RewardRuleWithTiers | null;
  canWrite: boolean;
};

export function RewardRulesManager({
  versions: initialVersions,
  activeRule: initialActiveRule,
  latestRule: initialLatestRule,
  editableDraft: initialEditableDraft,
  canWrite,
}: RewardRulesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [versions] = useState<RewardRuleWithTiers[]>(initialVersions);
  const [activeRule] = useState<RewardRuleWithTiers | null>(initialActiveRule);
  const [latestRule] = useState<RewardRuleWithTiers | null>(initialLatestRule);
  const [editableDraft] = useState<RewardRuleWithTiers | null>(initialEditableDraft);

  // Selected version for viewing/editing (defaults to latest or active)
  const defaultSelected = latestRule ?? activeRule ?? versions[0] ?? null;
  const [selectedVersionId, setSelectedVersionId] = useState<string>(defaultSelected?.id ?? "");

  const currentSelected = versions.find((v) => v.id === selectedVersionId) ?? defaultSelected;

  // Form state initialized from selected version
  const [formData, setFormData] = useState<RewardRuleInput>(() => {
    if (!currentSelected) {
      return {
        pointsPerApprovedVideo: 100,
        maxPointsPerCustomer: 500,
        maxSubmissionsPerPeriod: 2,
        periodDays: 30,
        pointExpiryDays: 365,
        minPointsToRedeem: 100,
        couponValidityDays: 90,
        allowCombineWithOffers: false,
        allowMultipleCouponsPerBooking: false,
        manualAdjustMaxPoints: 50,
        manualAdjustApprovalThreshold: 200,
        tiers: [],
      };
    }
    return {
      pointsPerApprovedVideo: currentSelected.pointsPerApprovedVideo,
      maxPointsPerCustomer: currentSelected.maxPointsPerCustomer,
      maxSubmissionsPerPeriod: currentSelected.maxSubmissionsPerPeriod,
      periodDays: currentSelected.periodDays,
      pointExpiryDays: currentSelected.pointExpiryDays,
      minPointsToRedeem: currentSelected.minPointsToRedeem,
      couponValidityDays: currentSelected.couponValidityDays,
      allowCombineWithOffers: currentSelected.allowCombineWithOffers,
      allowMultipleCouponsPerBooking: currentSelected.allowMultipleCouponsPerBooking,
      manualAdjustMaxPoints: currentSelected.manualAdjustMaxPoints,
      manualAdjustApprovalThreshold: currentSelected.manualAdjustApprovalThreshold,
      tiers: currentSelected.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        pointsCost: t.pointsCost,
        discountType: t.discountType,
        discountValue: t.discountValue,
        maxDiscountPaise: t.maxDiscountPaise,
        minBookingPaise: t.minBookingPaise,
        allPackages: t.allPackages,
        allAccommodation: t.allAccommodation,
        isActive: t.isActive,
        packageIds: [],
        accommodationIds: [],
      })),
    };
  });

  const [impactSummary, setImpactSummary] = useState<RuleImpactSummary | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Update form data when switching selected version
  function handleSelectVersion(id: string) {
    setSelectedVersionId(id);
    const rule = versions.find((v) => v.id === id);
    if (!rule) return;
    setFormData({
      pointsPerApprovedVideo: rule.pointsPerApprovedVideo,
      maxPointsPerCustomer: rule.maxPointsPerCustomer,
      maxSubmissionsPerPeriod: rule.maxSubmissionsPerPeriod,
      periodDays: rule.periodDays,
      pointExpiryDays: rule.pointExpiryDays,
      minPointsToRedeem: rule.minPointsToRedeem,
      couponValidityDays: rule.couponValidityDays,
      allowCombineWithOffers: rule.allowCombineWithOffers,
      allowMultipleCouponsPerBooking: rule.allowMultipleCouponsPerBooking,
      manualAdjustMaxPoints: rule.manualAdjustMaxPoints,
      manualAdjustApprovalThreshold: rule.manualAdjustApprovalThreshold,
      tiers: rule.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        pointsCost: t.pointsCost,
        discountType: t.discountType,
        discountValue: t.discountValue,
        maxDiscountPaise: t.maxDiscountPaise,
        minBookingPaise: t.minBookingPaise,
        allPackages: t.allPackages,
        allAccommodation: t.allAccommodation,
        isActive: t.isActive,
        packageIds: [],
        accommodationIds: [],
      })),
    });
    setImpactSummary(null);
    setValidationErrors([]);
  }

  function updateTier(index: number, patch: Partial<RewardTierInput>) {
    setFormData((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  }

  // Load provisional defaults action
  function handleLoadProvisionalDefaults() {
    startTransition(async () => {
      const res = await loadProvisionalDefaultsAction();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Loaded provisional defaults into new draft version ${res.data.version}.`);
      router.refresh();
    });
  }

  // Save new version
  function handleSaveNewVersion() {
    startTransition(async () => {
      setValidationErrors([]);
      const res = await saveRewardRuleVersionAction(formData);
      if (!res.ok) {
        toast.error(res.error.message);
        if (res.error.fieldErrors) {
          const flat = Object.entries(res.error.fieldErrors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
          setValidationErrors(flat);
        }
        return;
      }
      toast.success(`Saved new reward rule version ${res.data.version}. Provisional flag cleared.`);
      router.refresh();
    });
  }

  // Compute impact summary
  async function handleComputeImpact() {
    if (!currentSelected) return;
    setIsLoadingImpact(true);
    const res = await getRuleImpactSummaryAction(formData, currentSelected.version);
    setIsLoadingImpact(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setImpactSummary(res.data);
  }

  // Activate action
  function handleActivateRule(rule: RewardRuleWithTiers) {
    startTransition(async () => {
      const res = await activateRewardRuleAction({
        ruleId: rule.id,
        expectedVersion: rule.version,
        expectedUpdatedAt: rule.createdAt.toISOString(),
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Reward rule version ${res.data.activeVersion} is now LIVE and active!`);
      router.refresh();
    });
  }

  // Banner conditions
  const activeMeta = (activeRule?.meta as Record<string, unknown> | null) ?? {};
  const latestMeta = (latestRule?.meta as Record<string, unknown> | null) ?? {};
  const isActiveProvisional = activeRule?.isActive && activeMeta["provisional"] === true;
  const isLatestProvisional = !isActiveProvisional && latestMeta["provisional"] === true;

  return (
    <div className="space-y-8">
      {/* 1. Provisional Banner */}
      {isActiveProvisional ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-sm" role="alert">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-sm">
            <strong className="font-semibold">The active rule is still provisional</strong> — review and confirm with the client before relying on them.
            Values are placeholders subject to decision D-8.
          </div>
        </div>
      ) : isLatestProvisional ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-sm" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-sm">
            <strong className="font-semibold">Provisional defaults</strong> — review and confirm with the client before relying on them.
            Draft settings are placeholders subject to decision D-8.
          </div>
        </div>
      ) : null}

      {/* 2. Top Status Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider">Rewards Engine Status</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              {activeRule ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-forest-700" />
                  <span className="text-forest-900">Active (v{activeRule.version})</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground/40" />
                  <span className="text-muted-foreground">Rewards OFF</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {activeRule
              ? `Points: ${activeRule.pointsPerApprovedVideo} / approved video. ${activeRule.tiers.filter((t) => t.isActive).length} active tiers.`
              : "No rule is active. Public page and account dashboard suppress all reward amounts."}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider">Current Editable Draft</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {editableDraft ? `v${editableDraft.version}` : "None"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {editableDraft
              ? "Draft has never been active and has no ledger/coupon references."
              : "All versions are active or referenced. Saving will create a new draft."}
          </CardContent>
        </Card>

        <Card className="border-border/70 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider">Provisional Defaults Action</CardDescription>
            <CardTitle className="text-sm font-semibold">Load Defaults (D-8)</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleLoadProvisionalDefaults}
              disabled={!canWrite || isPending || Boolean(editableDraft)}
              title={editableDraft ? "Disabled: An editable draft already exists" : "Prefill a new draft version from provisional defaults"}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Load provisional defaults
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 3. Version Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Versions:</span>
        {versions.map((ver) => {
          const isActive = ver.isActive;
          const isSelected = ver.id === selectedVersionId;
          const meta = (ver.meta as Record<string, unknown> | null) ?? {};
          const isProv = meta["provisional"] === true;

          return (
            <button
              key={ver.id}
              onClick={() => handleSelectVersion(ver.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-forest-900 text-cream-50 shadow-sm"
                  : "bg-card border border-border/70 text-foreground hover:bg-muted"
              }`}
            >
              <span>v{ver.version}</span>
              {isActive ? (
                <span className="rounded-full bg-forest-700/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400">
                  LIVE
                </span>
              ) : null}
              {isProv ? (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-500">
                  PROVISIONAL
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Validation error display */}
      {validationErrors.length > 0 ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
          <strong className="block font-semibold mb-1">Validation Errors:</strong>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 4. Rule Settings Editor */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-xl font-heading text-forest-900">
                Rule Parameters (Version {currentSelected?.version ?? "New"})
              </CardTitle>
              <CardDescription>
                All fields are editable. Saving creates a new version without mutating live rules in place.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Points per Approved Video</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.pointsPerApprovedVideo}
                    onChange={(e) => setFormData({ ...formData, pointsPerApprovedVideo: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Points awarded when staff approve guest video.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Lifetime Cap per Customer</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.maxPointsPerCustomer ?? ""}
                    onChange={(e) => setFormData({ ...formData, maxPointsPerCustomer: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Optional (e.g. 500)"
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Must be ≥ points per approved video when set.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Max Submissions per Period</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.maxSubmissionsPerPeriod ?? ""}
                    onChange={(e) => setFormData({ ...formData, maxSubmissionsPerPeriod: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Optional (e.g. 2)"
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Limit videos a customer can submit.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Period Window (Days)</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.periodDays ?? ""}
                    onChange={(e) => setFormData({ ...formData, periodDays: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Required if submissions capped"
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Rolling days window for submission cap.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Point Expiry (Days)</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.pointExpiryDays ?? ""}
                    onChange={(e) => setFormData({ ...formData, pointExpiryDays: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Optional (e.g. 365)"
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Days before unspent points expire.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Min Points to Redeem</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.minPointsToRedeem}
                    onChange={(e) => setFormData({ ...formData, minPointsToRedeem: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Threshold required to generate any coupon.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Coupon Validity (Days)</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.couponValidityDays}
                    onChange={(e) => setFormData({ ...formData, couponValidityDays: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Days before redeemed coupon codes expire.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Manual Adjust Max Points (Staff Cap)</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.manualAdjustMaxPoints}
                    onChange={(e) => setFormData({ ...formData, manualAdjustMaxPoints: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Max points single staff can adjust without 2nd approval.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Manual Adjust 2nd Approval Threshold</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.manualAdjustApprovalThreshold}
                    onChange={(e) => setFormData({ ...formData, manualAdjustApprovalThreshold: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Adjustments exceeding this require manager approval.</p>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-col gap-3 pt-2 border-t border-border/70">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowCombineWithOffers}
                    onChange={(e) => setFormData({ ...formData, allowCombineWithOffers: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-forest-700"
                  />
                  <span>Allow combining reward coupons with special offers</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowMultipleCouponsPerBooking}
                    onChange={(e) => setFormData({ ...formData, allowMultipleCouponsPerBooking: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-forest-700"
                  />
                  <span>Allow multiple reward coupons on a single booking</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Reward Tiers Editor */}
          <Card className="border-border/70">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-heading text-forest-900">Reward Tiers</CardTitle>
                <CardDescription>
                  Discounts and coupon redemption rules. All money in UI is entered in Rupees (₹) and stored as integer paise.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newTier: RewardTierInput = {
                    name: `Tier ${formData.tiers.length + 1}`,
                    pointsCost: formData.minPointsToRedeem || 100,
                    discountType: "PERCENTAGE",
                    discountValue: 5,
                    maxDiscountPaise: 50000,
                    minBookingPaise: 500000,
                    allPackages: true,
                    allAccommodation: true,
                    isActive: true,
                    packageIds: [],
                    accommodationIds: [],
                  };
                  setFormData({ ...formData, tiers: [...formData.tiers, newTier] });
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Tier
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.tiers.map((tier, idx) => (
                <div key={idx} className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-laterite-600">Tier #{idx + 1}</span>
                      <Input
                        value={tier.name}
                        onChange={(e) => updateTier(idx, { name: e.target.value })}
                        className="h-7 w-40 text-xs font-semibold"
                        placeholder="Tier name"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={tier.isActive}
                          onChange={(e) => updateTier(idx, { isActive: e.target.checked })}
                        />
                        <span>Active</span>
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            tiers: prev.tiers.filter((_, i) => i !== idx),
                          }));
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Points Cost</label>
                      <Input
                        type="number"
                        min={formData.minPointsToRedeem}
                        value={tier.pointsCost}
                        onChange={(e) => updateTier(idx, { pointsCost: parseInt(e.target.value) || 0 })}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Discount Type</label>
                      <select
                        value={tier.discountType}
                        onChange={(e) => updateTier(idx, { discountType: e.target.value as "PERCENTAGE" | "FIXED" })}
                        className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED">Fixed Amount (₹)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        {tier.discountType === "PERCENTAGE" ? "Discount %" : "Discount (₹)"}
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={tier.discountType === "PERCENTAGE" ? 100 : undefined}
                        value={tier.discountType === "PERCENTAGE" ? tier.discountValue : Math.round(tier.discountValue / 100)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          updateTier(idx, {
                            discountValue: tier.discountType === "PERCENTAGE" ? val : Math.round(val * 100),
                          });
                        }}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Max Cap (₹)</label>
                      <Input
                        type="number"
                        min={0}
                        value={tier.maxDiscountPaise ? Math.round(tier.maxDiscountPaise / 100) : ""}
                        onChange={(e) => {
                          const val = e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null;
                          updateTier(idx, { maxDiscountPaise: val });
                        }}
                        placeholder="Optional cap"
                        className="mt-1 h-8 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted-foreground">Min Booking Value (₹)</label>
                      <Input
                        type="number"
                        min={0}
                        value={tier.minBookingPaise ? Math.round(tier.minBookingPaise / 100) : ""}
                        onChange={(e) => {
                          const val = e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null;
                          updateTier(idx, { minBookingPaise: val });
                        }}
                        placeholder="e.g. 5000"
                        className="mt-1 h-8 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center gap-4 pt-4">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tier.allPackages}
                          onChange={(e) => updateTier(idx, { allPackages: e.target.checked })}
                        />
                        <span>All Packages</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tier.allAccommodation}
                          onChange={(e) => updateTier(idx, { allAccommodation: e.target.checked })}
                        />
                        <span>All Accommodations</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Action Panel & Impact Summary */}
        <div className="space-y-6">
          <Card className="border-border/70 sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg font-heading text-forest-900">Actions &amp; Lifecycle</CardTitle>
              <CardDescription>
                Save as a new immutable version or activate an existing version.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Save New Version Button */}
              <Button
                variant="default"
                className="w-full bg-forest-900 hover:bg-forest-800 text-cream-50"
                onClick={handleSaveNewVersion}
                disabled={!canWrite || isPending}
              >
                Save as New Version
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Always creates a new version. Live rules are never edited in place.
              </p>

              {/* Impact Summary Trigger */}
              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={handleComputeImpact}
                disabled={isLoadingImpact}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-turmeric-700" />
                {isLoadingImpact ? "Computing..." : "Compare with Active Rule"}
              </Button>

              {/* Activate Button */}
              {currentSelected ? (
                <div className="pt-4 border-t border-border/70">
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant={currentSelected.isActive ? "outline" : "default"}
                        className={`w-full ${!currentSelected.isActive ? "bg-turmeric-500 hover:bg-turmeric-400 text-ink-900 font-semibold" : ""}`}
                        disabled={!canWrite || isPending || currentSelected.isActive}
                      >
                        {currentSelected.isActive ? "Currently Active" : `Activate Version ${currentSelected.version}`}
                      </Button>
                    }
                    title={`Activate Reward Rule Version ${currentSelected.version}?`}
                    description={`Activating version ${currentSelected.version} will make it the live reward engine rule. Points will be awarded at ${currentSelected.pointsPerApprovedVideo} pts/video, and previous active rule (v${activeRule?.version ?? "none"}) will be deactivated immediately.`}
                    confirmLabel={`Confirm & Activate v${currentSelected.version}`}
                    onConfirm={() => handleActivateRule(currentSelected)}
                  />
                  {currentSelected.isActive ? (
                    <p className="mt-1 text-[11px] text-emerald-600 text-center font-medium">
                      ✓ This version is currently LIVE.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Impact Summary Display */}
              {impactSummary ? (
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3 space-y-2 text-xs">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>Field Impact Summary:</span>
                    <span className="text-[10px] text-muted-foreground">
                      v{impactSummary.activeVersion ?? "none"} → v{impactSummary.targetVersion}
                    </span>
                  </div>

                  {impactSummary.changes.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No field changes from active rule.</p>
                  ) : (
                    <div className="space-y-1">
                      {impactSummary.changes.map((c, i) => (
                        <div key={i} className="text-[11px] border-b border-border/40 pb-1">
                          <span className="font-medium text-foreground">{c.label}:</span>{" "}
                          <span className="text-muted-foreground line-through">{String(c.previousValue ?? "none")}</span>{" "}
                          <ChevronRight className="inline h-3 w-3 text-muted-foreground" />{" "}
                          <span className="font-semibold text-forest-800">{String(c.newValue ?? "none")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {impactSummary.tierChanges.length > 0 ? (
                    <div className="pt-2 border-t border-border/40 space-y-1">
                      <span className="font-semibold text-[11px] block">Tier Changes:</span>
                      {impactSummary.tierChanges.map((t, idx) => (
                        <div key={idx} className="text-[10px] text-muted-foreground">
                          <strong className="text-foreground">{t.tierName}</strong> ({t.action}): {t.details}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
