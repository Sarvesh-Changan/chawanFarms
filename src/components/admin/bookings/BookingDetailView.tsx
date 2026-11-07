"use client";

import { AlertCircle, Eye, Trash2 } from "lucide-react";
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
import { viewGuestIdDocumentAction } from "@/server/actions/booking-id";

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
  guests?: Array<{
    id: string;
    fullName: string;
    ageGroup: string;
    idType: string;
    idMediaId: string | null;
    idPurgedAt: Date | string | null;
    createdAt?: Date | string;
  }>;
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
  canViewGuestIds?: boolean;
};

function formatLocalizedValue(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const text = record.en || record.mr || record.hi || Object.values(record)[0];
    if (typeof text === "string" && text.trim()) return text;
  }
  return fallback;
}

export function BookingDetailView({
  booking,
  auditLogs,
  canViewGuestIds = false,
}: BookingDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Guest IDs state
  const [viewingGuestId, setViewingGuestId] = useState<string | null>(null);
  const [guestIdError, setGuestIdError] = useState<string | null>(null);
  const [showConfirmWarningModal, setShowConfirmWarningModal] = useState(false);

  const totalExpectedGuests = booking.adults + booking.children4to10 + booking.infantsUnder4;
  const idsPending = (booking.guests?.length ?? 0) < totalExpectedGuests;

  const handleViewGuestId = async (guestId: string) => {
    setGuestIdError(null);
    setViewingGuestId(guestId);
    try {
      const res = await viewGuestIdDocumentAction(guestId);
      if (res.ok) {
        window.open(res.viewUrl, "_blank", "noopener,noreferrer");
      } else {
        setGuestIdError(res.error);
      }
    } catch {
      setGuestIdError("An unexpected error occurred while requesting document view.");
    } finally {
      setViewingGuestId(null);
    }
  };

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
                  className="bg-forest-900 text-cream-50 hover:bg-forest-700 shadow-sm font-semibold"
                  disabled={isPending}
                  onClick={() => {
                    if (booking.paymentStatus === "PAID") {
                      if (idsPending) {
                        setShowConfirmWarningModal(true);
                      } else {
                        handleStatusTransition("CONFIRMED");
                      }
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

      {idsPending ? (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 text-sm flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Identity documents pending ({booking.guests?.length ?? 0}/{totalExpectedGuests})</p>
            <p className="mt-0.5 text-xs text-amber-800">
              This booking does not yet have verified identity documents for all guests. All standard workflows remain available; please ensure physical documents are verified at check-in.
            </p>
          </div>
        </div>
      ) : null}

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
            <div>Package: <span className="font-medium text-foreground">{booking.package ? formatLocalizedValue(booking.package.name, "Standard") : "Standard"}</span></div>
            <div>Accommodation: <span className="font-medium text-foreground">{booking.accommodation ? formatLocalizedValue(booking.accommodation.name, "None") : "None"}</span></div>
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
                className="bg-forest-900 text-cream-50 hover:bg-forest-700 shadow-sm font-semibold"
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

      {/* Guest IDs Panel (Permission: bookings.ids.read) */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <div>
            <span className="font-semibold text-sm text-foreground">Guest Identity Documents</span>
            <span className="ml-2 text-xs text-muted-foreground">
              ({booking.guests?.length ?? 0} of {totalExpectedGuests} provided)
            </span>
          </div>
          {idsPending && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              IDs Pending
            </span>
          )}
        </div>

        {guestIdError && (
          <div className="border-b border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {guestIdError}
          </div>
        )}

        {!canViewGuestIds ? (
          <div className="p-4 text-xs text-muted-foreground italic">
            You do not have permission to view guest identity documents (requires <code>bookings.ids.read</code>).
          </div>
        ) : !booking.guests || booking.guests.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No identity documents have been submitted for this booking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground uppercase bg-muted/20">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Guest Name</th>
                  <th className="px-4 py-2">Age Group</th>
                  <th className="px-4 py-2">ID Type</th>
                  <th className="px-4 py-2 text-right">Document Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {booking.guests.map((g, idx) => {
                  const idTypeLabel =
                    g.idType === "AADHAAR"
                      ? "Aadhaar Card"
                      : g.idType === "PASSPORT"
                      ? "Passport"
                      : g.idType === "DRIVING_LICENCE"
                      ? "Driving Licence"
                      : g.idType === "VOTER_ID"
                      ? "Voter ID"
                      : g.idType === "PAN"
                      ? "PAN Card"
                      : g.idType === "STUDENT_ID"
                      ? "Student / School ID"
                      : g.idType === "BIRTH_CERTIFICATE"
                      ? "Birth Certificate"
                      : g.idType;

                  const ageGroupLabel =
                    g.ageGroup === "ADULT"
                      ? "Adult"
                      : g.ageGroup === "CHILD_4_10"
                      ? "Child (4–10 yrs)"
                      : g.ageGroup === "INFANT_UNDER_4"
                      ? "Infant (under 4 yrs)"
                      : g.ageGroup;

                  return (
                    <tr key={g.id}>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {g.fullName}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="rounded bg-muted px-2 py-0.5 font-medium">
                          {ageGroupLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {idTypeLabel}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {g.idPurgedAt ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                            <Trash2 className="size-3.5" />
                            Purged on {new Date(g.idPurgedAt).toLocaleDateString("en-IN")}
                          </span>
                        ) : g.idMediaId ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={viewingGuestId === g.id}
                            onClick={() => handleViewGuestId(g.id)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Eye className="size-3.5" />
                            {viewingGuestId === g.id ? "Loading..." : "View Document"}
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">
                            Document Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
            {idsPending ? (
              <div className="rounded border border-amber-400 bg-amber-50 p-2.5 text-xs text-amber-800 font-semibold flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-amber-600" />
                <span>Warning: Identity documents are pending ({booking.guests?.length ?? 0}/{totalExpectedGuests} provided).</span>
              </div>
            ) : null}
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
                className="bg-forest-900 text-cream-50 hover:bg-forest-700 shadow-sm font-semibold"
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

      {/* Pending IDs Confirmation Warning Modal */}
      {showConfirmWarningModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-600" />
              Confirm Booking with Pending IDs
            </h3>
            <p className="text-sm text-muted-foreground">
              This booking currently has <strong>{booking.guests?.length ?? 0} of {totalExpectedGuests}</strong> guest identity documents submitted.
            </p>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
              Staff may confirm this booking, but physical identity documents must be inspected and verified in accordance with Maharashtra Tourism guidelines upon guest arrival.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowConfirmWarningModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-forest-900 text-cream-50 hover:bg-forest-700 shadow-sm font-semibold"
                disabled={isPending}
                onClick={() => {
                  setShowConfirmWarningModal(false);
                  handleStatusTransition("CONFIRMED");
                }}
              >
                Confirm Anyway
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
                className="bg-forest-900 text-cream-50 hover:bg-forest-700 shadow-sm font-semibold"
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
                className="bg-forest-900 text-cream-50 hover:bg-forest-700 shadow-sm font-semibold"
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
