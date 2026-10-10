"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createManualBookingAction } from "@/server/actions/admin-bookings";

export type PackageOption = {
  id: string;
  slug: string;
  name: unknown;
  minGuests?: number | null;
  maxGuests?: number | null;
};

export type AccommodationOption = {
  id: string;
  slug: string;
  name: unknown;
};

type ManualBookingFormProps = {
  packages: PackageOption[];
  accommodations: AccommodationOption[];
  canConfirm: boolean;
};

type AdjustmentRow = {
  label: string;
  amountRupees: string;
  reason: string;
};

export function ManualBookingForm({
  packages,
  accommodations,
  canConfirm,
}: ManualBookingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState("2");
  const [children4to10, setChildren4to10] = useState("0");
  const [infantsUnder4, setInfantsUnder4] = useState("0");
  const [packageSlug, setPackageSlug] = useState<string>("package-a");
  const [accommodationSlug, setAccommodationSlug] = useState<string>("camping-tents");
  const [foodPreference, setFoodPreference] = useState<"VEG" | "NON_VEG">("VEG");
  const [specialRequests, setSpecialRequests] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [directConfirm, setDirectConfirm] = useState(false);
  const [directConfirmOverrideReason, setDirectConfirmOverrideReason] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function addAdjustmentRow() {
    setAdjustments((prev) => [...prev, { label: "", amountRupees: "0", reason: "" }]);
  }

  function removeAdjustmentRow(idx: number) {
    setAdjustments((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAdjustment(idx: number, field: keyof AdjustmentRow, val: string) {
    setAdjustments((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row)),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!contactName.trim() || !contactPhone.trim() || !checkIn || !checkOut) {
      setErrorMsg("Please fill in contact name, phone, check-in, and check-out dates.");
      return;
    }

    if (directConfirm && !directConfirmOverrideReason.trim()) {
      setErrorMsg("An override reason is required for direct confirmation of an unpaid booking.");
      return;
    }

    const parsedAdjustments = adjustments.map((a) => {
      const rupees = parseFloat(a.amountRupees) || 0;
      return {
        label: a.label.trim(),
        amountPaise: Math.round(rupees * 100),
        reason: a.reason.trim(),
      };
    });

    for (const adj of parsedAdjustments) {
      if (!adj.label || !adj.reason) {
        setErrorMsg("All adjustment lines must have a valid label and reason.");
        return;
      }
    }

    startTransition(async () => {
      const res = await createManualBookingAction({
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim() || undefined,
        checkIn,
        checkOut,
        adults: parseInt(adults, 10) || 1,
        children4to10: parseInt(children4to10, 10) || 0,
        infantsUnder4: parseInt(infantsUnder4, 10) || 0,
        packageSlug: packageSlug || undefined,
        accommodationSlug: accommodationSlug || undefined,
        foodPreference,
        specialRequests: specialRequests.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        directConfirm,
        directConfirmOverrideReason: directConfirm ? directConfirmOverrideReason.trim() : undefined,
        adjustments: parsedAdjustments.length > 0 ? parsedAdjustments : undefined,
        idempotencyKey,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Failed to create manual booking.");
      } else if ("booking" in res && res.booking && "id" in res.booking) {
        router.push(`/admin/bookings/${res.booking.id}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Manual Booking"
        eyebrow="Phone / WhatsApp Reservation"
        description="Create a booking request manually. Uses the exact pricing and group rules engine."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/bookings">← Cancel</Link>
          </Button>
        }
      />

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Error:</strong> {errorMsg}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Guest Details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-forest-900">
            1. Guest Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Contact Name *
              </label>
              <Input
                className="mt-1"
                placeholder="Full Name"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Contact Phone *
              </label>
              <Input
                className="mt-1"
                placeholder="10-digit mobile"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Contact Email
              </label>
              <Input
                type="email"
                className="mt-1"
                placeholder="Optional email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Stay & Guests */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-forest-900">
            2. Dates & Guests
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Check-In Date *
              </label>
              <Input
                type="date"
                className="mt-1"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Check-Out Date *
              </label>
              <Input
                type="date"
                className="mt-1"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground">Same date = Day Visit</span>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Adults (11+) *
              </label>
              <Input
                type="number"
                min="1"
                className="mt-1"
                required
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Children (4–10)
              </label>
              <Input
                type="number"
                min="0"
                className="mt-1"
                value={children4to10}
                onChange={(e) => setChildren4to10(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Infants (&lt;4 Free)
              </label>
              <Input
                type="number"
                min="0"
                className="mt-1"
                value={infantsUnder4}
                onChange={(e) => setInfantsUnder4(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Package & Accommodation */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-forest-900">
            3. Package & Preferences
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Package
              </label>
              <Select value={packageSlug} onValueChange={setPackageSlug}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.slug}>
                      {typeof pkg.name === "object" ? JSON.stringify(pkg.name) : String(pkg.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Accommodation
              </label>
              <Select value={accommodationSlug} onValueChange={setAccommodationSlug}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accommodations.map((acc) => (
                    <SelectItem key={acc.id} value={acc.slug}>
                      {typeof acc.name === "object" ? JSON.stringify(acc.name) : String(acc.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Food Preference
              </label>
              <Select
                value={foodPreference}
                onValueChange={(val) => setFoodPreference(val as "VEG" | "NON_VEG")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VEG">Vegetarian</SelectItem>
                  <SelectItem value="NON_VEG">Non-Vegetarian (Chicken)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Special Guest Requests
              </label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="Dietary, early check-in, etc."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Internal Notes (Staff Only)
              </label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="Internal notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Priced Adjustments (Permission Gated) */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wide text-forest-900">
                4. Priced Adjustment Lines (Extras / Discounts)
              </h3>
              <p className="text-xs text-muted-foreground">
                Positive amounts are added as EXTRA; negative amounts are deducted as DISCOUNT.
                {canConfirm
                  ? " You have 'bookings.confirm' permission to adjust prices."
                  : " Disabled: requires 'bookings.confirm' permission (Reservations role cannot override price)."}
              </p>
            </div>
            {canConfirm ? (
              <Button type="button" size="sm" variant="outline" onClick={addAdjustmentRow}>
                + Add Adjustment
              </Button>
            ) : null}
          </div>

          {adjustments.length > 0 ? (
            <div className="space-y-3">
              {adjustments.map((adj, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-4 items-center rounded border border-border p-2 bg-muted/20"
                >
                  <Input
                    placeholder="Label (e.g. Extra mutton 2kg or Loyalty discount)"
                    value={adj.label}
                    disabled={!canConfirm}
                    onChange={(e) => updateAdjustment(idx, "label", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount in ₹ (+ or -)"
                    value={adj.amountRupees}
                    disabled={!canConfirm}
                    onChange={(e) => updateAdjustment(idx, "amountRupees", e.target.value)}
                  />
                  <Input
                    placeholder="Mandatory reason for audit"
                    value={adj.reason}
                    disabled={!canConfirm}
                    onChange={(e) => updateAdjustment(idx, "reason", e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-700"
                      onClick={() => removeAdjustmentRow(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Confirmation Options */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-forest-900">
            5. Confirmation Status
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="directConfirm"
              checked={directConfirm}
              disabled={!canConfirm}
              onChange={(e) => setDirectConfirm(e.target.checked)}
              className="h-4 w-4 rounded border-border text-forest-800"
            />
            <label htmlFor="directConfirm" className="text-sm font-medium">
              Directly confirm booking without advance payment
            </label>
          </div>
          {directConfirm ? (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Override Reason (Mandatory & Audited) *
              </label>
              <Input
                className="mt-1"
                placeholder="e.g. Offline payment collected in cash at reception / Manager approval"
                required
                value={directConfirmOverrideReason}
                onChange={(e) => setDirectConfirmOverrideReason(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/bookings">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="bg-forest-800 text-white hover:bg-forest-900"
            disabled={isPending}
          >
            {isPending ? "Submitting..." : "Create Reservation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
