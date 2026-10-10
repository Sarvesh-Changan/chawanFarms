"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
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
import {
  markPaymentBouncedAction,
  markPaymentClearedAction,
  recordManualPaymentAction,
  recordRefundAction,
  rescheduleBookingDatesAction,
  transitionBookingStatusAction,
  updateBookingNotesAction,
} from "@/server/actions/admin-bookings";

export type BookingDetail = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  checkIn: Date | string;
  checkOut: Date | string;
  nights: number;
  adults: number;
  children4to10: number;
  infantsUnder4: number;
  foodPreference: string | null;
  specialRequests: string | null;
  internalNotes: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  holdExpiresAt: Date | string | null;
  confirmedAt: Date | string | null;
  cancelledAt: Date | string | null;
  cancelReason: string | null;
  createdAt: Date | string;
  package?: { id: string; name: unknown; slug: string } | null;
  accommodation?: { id: string; name: unknown; slug: string } | null;
  lines: Array<{
    id: string;
    kind: string;
    label: string;
    quantity: number;
    unitPaise: number;
    totalPaise: number;
    meta?: unknown;
  }>;
  payments: Array<{
    id: string;
    method: string;
    status: string;
    amountPaise: number;
    reference: string | null;
    receivedAt: Date | string | null;
    clearedAt: Date | string | null;
    note: string | null;
  }>;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date | string;
  actor?: unknown;
};

type BookingDetailViewProps = {
  booking: BookingDetail;
  auditLogs: AuditLogEntry[];
};

export function BookingDetailView({ booking, auditLogs }: BookingDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Status transition state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentAmountRupees, setPaymentAmountRupees] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmountRupees, setRefundAmountRupees] = useState("");
  const [refundRef, setRefundRef] = useState("");
  const [refundNote, setRefundNote] = useState("");

  // Reschedule state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const checkInDateStr =
    typeof booking.checkIn === "string"
      ? booking.checkIn.slice(0, 10)
      : booking.checkIn.toISOString().slice(0, 10);
  const checkOutDateStr =
    typeof booking.checkOut === "string"
      ? booking.checkOut.slice(0, 10)
      : booking.checkOut.toISOString().slice(0, 10);
  const [newCheckIn, setNewCheckIn] = useState(checkInDateStr);
  const [newCheckOut, setNewCheckOut] = useState(checkOutDateStr);
  const [rescheduleReason, setRescheduleReason] = useState("");

  // Internal notes state
  const [internalNotesText, setInternalNotesText] = useState(booking.internalNotes || "");

  const outstandingPaise = Math.max(0, booking.totalPaise - booking.amountPaidPaise);

  function resetNotifications() {
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  function handleStatusTransition(targetStatus: string, reason?: string, override?: string) {
    resetNotifications();
    startTransition(async () => {
      const res = await transitionBookingStatusAction({
        bookingId: booking.id,
        targetStatus,
        cancelReason: reason,
        overridePaymentReason: override,
      });
      if (!res.ok) {
        setErrorMsg(res.error || "Failed to transition status.");
      } else {
        setSuccessMsg(`Status updated to ${targetStatus}.`);
        setShowOverrideModal(false);
        setShowCancelModal(false);
        router.refresh();
      }
    });
  }

  function handleRecordPayment() {
    resetNotifications();
    const rupees = parseFloat(paymentAmountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setErrorMsg("Please enter a valid positive payment amount.");
      return;
    }
    const amountPaise = Math.round(rupees * 100);

    startTransition(async () => {
      const res = await recordManualPaymentAction({
        bookingId: booking.id,
        method: paymentMethod,
        amountPaise,
        reference: paymentRef,
        note: paymentNote,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Failed to record payment.");
      } else {
        setSuccessMsg("Payment recorded successfully.");
        setShowPaymentModal(false);
        setPaymentAmountRupees("");
        setPaymentRef("");
        setPaymentNote("");
        router.refresh();
      }
    });
  }

  function handleClearPayment(paymentId: string) {
    resetNotifications();
    startTransition(async () => {
      const res = await markPaymentClearedAction({ paymentId });
      if (!res.ok) {
        setErrorMsg(res.error || "Failed to clear payment.");
      } else {
        setSuccessMsg("Payment marked as cleared.");
        router.refresh();
      }
    });
  }

  function handleBouncePayment(paymentId: string) {
    const reason = prompt("Enter bounce reason (e.g. Insufficient funds / signature mismatch):");
    if (!reason || !reason.trim()) return;
    resetNotifications();
    startTransition(async () => {
      const res = await markPaymentBouncedAction({ paymentId, bounceReason: reason.trim() });
      if (!res.ok) {
        setErrorMsg(res.error || "Failed to mark bounced.");
      } else {
        setSuccessMsg("Payment marked as bounced.");
        router.refresh();
      }
    });
  }

  function handleRecordRefund() {
    resetNotifications();
    const rupees = parseFloat(refundAmountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setErrorMsg("Please enter a valid positive refund amount.");
      return;
    }
    const amountPaise = Math.round(rupees * 100);

    startTransition(async () => {
      const res = await recordRefundAction({
        bookingId: booking.id,
        amountPaise,
        reference: refundRef,
        note: refundNote,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Failed to record refund.");
      } else {
        setSuccessMsg("Refund recorded successfully.");
        setShowRefundModal(false);
        setRefundAmountRupees("");
        setRefundRef("");
        setRefundNote("");
        router.refresh();
      }
    });
  }

  function handleReschedule() {
    resetNotifications();
    if (!rescheduleReason.trim()) {
      setErrorMsg("A mandatory reason is required to reschedule dates.");
      return;
    }

    startTransition(async () => {
      const res = await rescheduleBookingDatesAction({
        bookingId: booking.id,
        newCheckIn,
        newCheckOut,
        reason: rescheduleReason.trim(),
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Failed to reschedule booking dates.");
      } else {
        setSuccessMsg("Booking dates rescheduled successfully.");
        setShowRescheduleModal(false);
        setRescheduleReason("");
        router.refresh();
      }
    });
  }

  function handleSaveNotes() {
    resetNotifications();
    startTransition(async () => {
      const res = await updateBookingNotesAction({
        bookingId: booking.id,
        internalNotes: internalNotesText,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Failed to save internal notes.");
      } else {
        setSuccessMsg("Internal notes saved.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Booking ${booking.reference}`}
        eyebrow="Reservation Detail"
        description={`Submitted on ${new Date(booking.createdAt).toLocaleDateString("en-IN")}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/bookings">← Back to List</Link>
            </Button>

            {booking.status === "PENDING_CONFIRMATION" || booking.status === "ENQUIRY" ? (
              <>
                <Button
                  className="bg-forest-800 text-white hover:bg-forest-900"
                  disabled={isPending}
                  onClick={() => {
                    if (booking.paymentStatus === "PAID") {
                      handleStatusTransition("CONFIRMED");
                    } else {
                      setShowOverrideModal(true);
                    }
                  }}
                >
                  Confirm Booking
                </Button>
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel Booking
                </Button>
              </>
            ) : null}

            {booking.status === "CONFIRMED" ? (
              <>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleStatusTransition("COMPLETED")}
                >
                  Mark Completed
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleStatusTransition("NO_SHOW")}
                >
                  Mark No-Show
                </Button>
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel Booking
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Error:</strong> {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {successMsg}
        </div>
      ) : null}

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Guest & Reservation */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
            Guest Details
          </h3>
          <div className="text-sm space-y-1">
            <div className="font-medium text-base text-forest-900">{booking.contactName}</div>
            <div>Phone: <span className="font-mono">{booking.contactPhone}</span></div>
            <div>Email: {booking.contactEmail || "Not provided"}</div>
          </div>
          <div className="border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
            <div>Guests: {booking.adults} Adults, {booking.children4to10} Children (4-10), {booking.infantsUnder4} Infants</div>
            <div>Food Option: <span className="font-medium">{booking.foodPreference || "Standard"}</span></div>
            {booking.specialRequests ? (
              <div className="mt-2 rounded bg-muted/40 p-2 italic text-foreground">
                &ldquo;{booking.specialRequests}&rdquo;
              </div>
            ) : null}
          </div>
        </div>

        {/* Stay & Inventory */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
              Stay & Inventory
            </h3>
            <Button
              size="sm"
              variant="outline"
              disabled={["CANCELLED", "REJECTED", "COMPLETED"].includes(booking.status)}
              onClick={() => setShowRescheduleModal(true)}
            >
              Reschedule Dates
            </Button>
          </div>
          <div className="text-sm space-y-1">
            <div>Check-in: <span className="font-mono font-medium">{checkInDateStr}</span></div>
            <div>Check-out: <span className="font-mono font-medium">{checkOutDateStr}</span></div>
            <div>Duration: {booking.nights === 0 ? "Day Visit (0 nights)" : `${booking.nights} night(s)`}</div>
            <div>Package: {booking.package ? (typeof booking.package.name === "object" ? JSON.stringify(booking.package.name) : String(booking.package.name)) : "Standard"}</div>
            <div>Accommodation: {booking.accommodation ? (typeof booking.accommodation.name === "object" ? JSON.stringify(booking.accommodation.name) : String(booking.accommodation.name)) : "None"}</div>
          </div>
          <div className="border-t border-border pt-3 flex gap-2">
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.paymentStatus} />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
              Payment Summary
            </h3>
            <div className="flex gap-1">
              <Button
                size="sm"
                className="bg-forest-800 text-white hover:bg-forest-900"
                disabled={outstandingPaise <= 0 || isPending}
                onClick={() => setShowPaymentModal(true)}
              >
                + Record Payment
              </Button>
              {booking.amountPaidPaise > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setShowRefundModal(true)}
                >
                  Refund
                </Button>
              ) : null}
            </div>
          </div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Quote:</span>
              <span className="font-medium">₹{(booking.totalPaise / 100).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cleared Payments:</span>
              <span className="font-medium text-emerald-700">₹{(booking.amountPaidPaise / 100).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Outstanding:</span>
              <span className={outstandingPaise > 0 ? "text-amber-700" : "text-emerald-700"}>
                ₹{(outstandingPaise / 100).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Note: Offline payments only (D-1). Cheques start PENDING until cleared.
          </p>
        </div>
      </div>

      {/* Pricing Lines */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-3 font-semibold text-sm">
          Price Lines Breakdown
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground uppercase bg-muted/20">
            <tr>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Quantity</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {booking.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 font-mono text-xs">{l.kind}</td>
                <td className="px-4 py-2.5">{l.label}</td>
                <td className="px-4 py-2.5 text-right">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right">₹{(l.unitPaise / 100).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-right font-medium">₹{(l.totalPaise / 100).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 font-semibold text-sm">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right">Total Payable:</td>
              <td className="px-4 py-2 text-right">₹{(booking.totalPaise / 100).toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payments History */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-3 font-semibold text-sm flex justify-between items-center">
          <span>Recorded Offline Payments</span>
          <span className="text-xs text-muted-foreground">Cleared entries are immutable</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground uppercase bg-muted/20">
            <tr>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Received Date</th>
              <th className="px-4 py-2">Cleared Date</th>
              <th className="px-4 py-2">Note</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {booking.payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-foreground">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              booking.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.method}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2.5 font-semibold">
                    ₹{(p.amountPaise / 100).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono">{p.reference || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {p.receivedAt ? new Date(p.receivedAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {p.clearedAt ? new Date(p.clearedAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.note || "—"}</td>
                  <td className="px-4 py-2.5 text-right space-x-2">
                    {p.status === "PENDING" ? (
                      <>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                          disabled={isPending}
                          onClick={() => handleClearPayment(p.id)}
                        >
                          Mark Cleared
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={isPending}
                          onClick={() => handleBouncePayment(p.id)}
                        >
                          Mark Bounced
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Settled</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Internal Notes & Timeline */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Internal Notes */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide">
            Internal Staff Notes (Plain Text, max 2000 chars)
          </h3>
          <Textarea
            value={internalNotesText}
            onChange={(e) => setInternalNotesText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Add internal notes for staff reference..."
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {internalNotesText.length} / 2000 characters
            </span>
            <Button size="sm" disabled={isPending} onClick={handleSaveNotes}>
              Save Notes
            </Button>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide">
            Booking Audit Timeline
          </h3>
          <div className="max-h-60 overflow-y-auto space-y-2 text-xs divide-y divide-border">
            {auditLogs.length === 0 ? (
              <p className="text-muted-foreground py-2">No audit log entries recorded yet.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="pt-2">
                  <div className="flex justify-between font-mono font-medium text-forest-900">
                    <span>{log.action}</span>
                    <span className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {log.after ? (
                    <div className="mt-1 text-muted-foreground font-mono truncate">
                      {typeof log.after === "object" ? JSON.stringify(log.after) : String(log.after)}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Override Modal */}
      {showOverrideModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">
              Confirm Unpaid Booking
            </h3>
            <p className="text-sm text-muted-foreground">
              This booking currently has an outstanding balance of ₹{(outstandingPaise / 100).toLocaleString("en-IN")}.
              Per Decision D-1, confirmations require 100% payment unless an explicit override reason is provided by staff with `bookings.confirm` permission.
            </p>
            <div>
              <label className="text-xs font-semibold text-foreground">
                Override Reason (Mandatory & Audited)
              </label>
              <Input
                className="mt-1"
                placeholder="e.g. VIP guest or payment verified via bank counter"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-forest-800 text-white hover:bg-forest-900"
                disabled={!overrideReason.trim() || isPending}
                onClick={() =>
                  handleStatusTransition("CONFIRMED", undefined, overrideReason.trim())
                }
              >
                Confirm with Override
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cancellation Modal */}
      {showCancelModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-destructive">
              Cancel Booking
            </h3>
            <p className="text-sm text-muted-foreground">
              Cancelling will release the inventory holds. Per Decision D-2, no automated refund is issued.
              The customer cancellation email will not promise a refund.
            </p>
            <div>
              <label className="text-xs font-semibold text-foreground">
                Cancellation Reason (Mandatory & Audited)
              </label>
              <Input
                className="mt-1"
                placeholder="e.g. Customer requested cancellation due to weather"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={!cancelReason.trim() || isPending}
                onClick={() => handleStatusTransition("CANCELLED", cancelReason.trim())}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Record Payment Modal */}
      {showPaymentModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">
              Record Offline Payment
            </h3>
            <p className="text-xs text-muted-foreground">
              Maximum allowable payment is the outstanding balance of ₹{(outstandingPaise / 100).toLocaleString("en-IN")}. Overpayments are rejected.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Payment Method
                </label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                    <SelectItem value="CHEQUE">Cheque (Starts PENDING)</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card POS</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Amount in Rupees (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-1"
                  placeholder={`Max ₹${outstandingPaise / 100}`}
                  value={paymentAmountRupees}
                  onChange={(e) => setPaymentAmountRupees(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Reference / Transaction ID
                </label>
                <Input
                  className="mt-1"
                  placeholder="UTR / Cheque No. / Transaction ID"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Internal Note (Optional)
                </label>
                <Input
                  className="mt-1"
                  placeholder="Optional staff note"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-forest-800 text-white hover:bg-forest-900"
                disabled={!paymentAmountRupees || isPending}
                onClick={handleRecordPayment}
              >
                Save Payment
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Record Refund Modal */}
      {showRefundModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">
              Record Manual Refund
            </h3>
            <p className="text-xs text-muted-foreground">
              Amount cannot exceed total cleared payments of ₹{(booking.amountPaidPaise / 100).toLocaleString("en-IN")}.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Refund Amount in Rupees (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-1"
                  placeholder={`Max ₹${booking.amountPaidPaise / 100}`}
                  value={refundAmountRupees}
                  onChange={(e) => setRefundAmountRupees(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Reference / Transfer UTR
                </label>
                <Input
                  className="mt-1"
                  placeholder="Bank UTR / Cheque No."
                  value={refundRef}
                  onChange={(e) => setRefundRef(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Reason / Note
                </label>
                <Input
                  className="mt-1"
                  placeholder="Reason for refund"
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowRefundModal(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!refundAmountRupees || isPending}
                onClick={handleRecordRefund}
              >
                Record Refund
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reschedule Dates Modal */}
      {showRescheduleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">
              Reschedule Reservation Dates
            </h3>
            <p className="text-xs text-muted-foreground">
              Releases old inventory and acquires new inventory in ONE locked transaction.
              Requires `bookings.write` and `availability.write`.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  New Check-In Date
                </label>
                <Input
                  type="date"
                  className="mt-1"
                  value={newCheckIn}
                  onChange={(e) => setNewCheckIn(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  New Check-Out Date
                </label>
                <Input
                  type="date"
                  className="mt-1"
                  value={newCheckOut}
                  onChange={(e) => setNewCheckOut(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Reason for Rescheduling (Mandatory)
                </label>
                <Input
                  className="mt-1"
                  placeholder="Guest request due to emergency / farm maintenance"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowRescheduleModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-forest-800 text-white hover:bg-forest-900"
                disabled={!rescheduleReason.trim() || isPending}
                onClick={handleReschedule}
              >
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
