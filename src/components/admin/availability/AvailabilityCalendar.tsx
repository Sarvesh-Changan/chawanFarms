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
import {
  createBlackoutPeriodAction,
  toggleDateBlockAction,
  updateDateCapacityAction,
} from "@/server/actions/admin-availability";

export type AccommodationItem = {
  id: string;
  slug: string;
  name: unknown;
};

export type AvailabilityDayData = {
  id: string;
  accommodationId: string;
  date: string;
  capacity: number;
  held: number;
  booked: number;
  isBlocked: boolean;
};

export type BlackoutPeriodData = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  appliesToAll: boolean;
};

type AvailabilityCalendarProps = {
  accommodations: AccommodationItem[];
  selectedAccommodationId: string;
  days: AvailabilityDayData[];
  blackouts: BlackoutPeriodData[];
  startDate: string;
  endDate: string;
};

export function AvailabilityCalendar({
  accommodations,
  selectedAccommodationId,
  days,
  blackouts,
  startDate,
  endDate,
}: AvailabilityCalendarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Capacity edit state
  const [editingCapacityDate, setEditingCapacityDate] = useState<string | null>(null);
  const [capacityInput, setCapacityInput] = useState<string>("");

  // Affected bookings confirmation modal
  const [affectedModal, setAffectedModal] = useState<{
    date: string;
    affectedBookings: Array<{ id: string; reference: string; contactName: string; status: string }>;
  } | null>(null);

  // Blackout modal state
  const [showBlackoutModal, setShowBlackoutModal] = useState(false);
  const [blackoutStart, setBlackoutStart] = useState(startDate);
  const [blackoutEnd, setBlackoutEnd] = useState(endDate);
  const [blackoutReason, setBlackoutReason] = useState("");

  function resetNotifications() {
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  function handleAccommodationChange(accId: string) {
    resetNotifications();
    router.push(
      `/admin/availability?accommodationId=${accId}&startDate=${startDate}&endDate=${endDate}`,
    );
  }

  function handleDateRangeChange(newStart: string, newEnd: string) {
    resetNotifications();
    router.push(
      `/admin/availability?accommodationId=${selectedAccommodationId}&startDate=${newStart}&endDate=${newEnd}`,
    );
  }

  function handleSaveCapacity(date: string) {
    resetNotifications();
    const cap = parseInt(capacityInput, 10);
    if (isNaN(cap) || cap < 0) {
      setErrorMsg("Please enter a valid non-negative capacity.");
      return;
    }

    startTransition(async () => {
      const res = await updateDateCapacityAction({
        accommodationId: selectedAccommodationId,
        date,
        capacity: cap,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Failed to update capacity.");
      } else {
        setSuccessMsg(`Capacity on ${date} updated to ${cap}.`);
        setEditingCapacityDate(null);
        router.refresh();
      }
    });
  }

  function handleToggleBlock(date: string, isBlocked: boolean, confirmAffected = false) {
    resetNotifications();
    startTransition(async () => {
      const res = await toggleDateBlockAction({
        accommodationId: selectedAccommodationId,
        date,
        isBlocked,
        confirmAffected,
      });

      if (!res.ok) {
        if (res.requiresConfirmation && res.affectedBookings) {
          setAffectedModal({
            date,
            affectedBookings: res.affectedBookings,
          });
        } else {
          setErrorMsg(res.error || "Failed to update date block status.");
        }
      } else {
        setSuccessMsg(`Date ${date} ${isBlocked ? "blocked" : "unblocked"} successfully.`);
        setAffectedModal(null);
        router.refresh();
      }
    });
  }

  function handleCreateBlackout() {
    resetNotifications();
    if (!blackoutStart || !blackoutEnd) {
      setErrorMsg("Please select start and end dates.");
      return;
    }

    startTransition(async () => {
      const res = await createBlackoutPeriodAction({
        startDate: blackoutStart,
        endDate: blackoutEnd,
        reason: blackoutReason.trim() || undefined,
        appliesToAll: true,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Failed to create blackout period.");
      } else {
        setSuccessMsg("Blackout period created.");
        setShowBlackoutModal(false);
        setBlackoutReason("");
        router.refresh();
      }
    });
  }

  // Create date lookup
  const dayMap = new Map(days.map((d) => [d.date, d]));

  // Generate date list between startDate and endDate
  const dateList: string[] = [];
  const curr = new Date(`${startDate}T00:00:00.000Z`);
  const stop = new Date(`${endDate}T00:00:00.000Z`);
  while (curr <= stop) {
    dateList.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability & Capacity"
        eyebrow="Inventory Grid"
        description="Monitor held/booked units, set daily capacity, and block dates or blackout farm closure windows."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/calendar">Arrivals & Calendar</Link>
            </Button>
            <Button
              className="bg-forest-800 text-white hover:bg-forest-900"
              onClick={() => setShowBlackoutModal(true)}
            >
              + Add Blackout Period
            </Button>
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

      {/* Controls */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Select Accommodation
          </label>
          <Select
            value={selectedAccommodationId}
            onValueChange={handleAccommodationChange}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accommodations.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {typeof acc.name === "object" ? JSON.stringify(acc.name) : String(acc.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            From Date (Asia/Kolkata)
          </label>
          <Input
            type="date"
            className="mt-1"
            value={startDate}
            onChange={(e) => handleDateRangeChange(e.target.value, endDate)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            To Date (Asia/Kolkata)
          </label>
          <Input
            type="date"
            className="mt-1"
            value={endDate}
            onChange={(e) => handleDateRangeChange(startDate, e.target.value)}
          />
        </div>
      </div>

      {/* Blackouts Overview */}
      {blackouts.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 space-y-2">
          <h4 className="font-semibold text-xs text-amber-900 uppercase tracking-wide">
            Active Farm Blackout Periods in Selected Window
          </h4>
          <div className="space-y-1 text-xs text-amber-800">
            {blackouts.map((b) => (
              <div key={b.id} className="flex justify-between font-mono">
                <span>
                  {b.startDate} → {b.endDate}: {b.reason || "Scheduled closure"}
                </span>
                <span className="font-sans font-medium">All Units Blocked</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Availability Grid Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total Capacity</th>
                <th className="px-4 py-3">Held (Soft Holds)</th>
                <th className="px-4 py-3">Booked (Confirmed)</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Blocked Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dateList.map((dStr) => {
                const day = dayMap.get(dStr);
                const capacity = day ? day.capacity : 0;
                const held = day ? day.held : 0;
                const booked = day ? day.booked : 0;
                const isBlocked = day ? day.isBlocked : false;
                const available = capacity > 0 ? Math.max(0, capacity - booked - held) : "Unlimited";
                const isEditing = editingCapacityDate === dStr;

                return (
                  <tr key={dStr} className={`hover:bg-muted/30 ${isBlocked ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 font-mono font-medium">{dStr}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            className="h-8 w-20 text-xs"
                            value={capacityInput}
                            onChange={(e) => setCapacityInput(e.target.value)}
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-forest-800 text-white"
                            onClick={() => handleSaveCapacity(dStr)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => setEditingCapacityDate(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{capacity === 0 ? "0 (Unconstrained)" : capacity}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingCapacityDate(dStr);
                              setCapacityInput(String(capacity));
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-amber-700 font-semibold">{held}</td>
                    <td className="px-4 py-3 text-emerald-700 font-semibold">{booked}</td>
                    <td className="px-4 py-3 font-medium">
                      {isBlocked ? (
                        <span className="text-red-700">Blocked</span>
                      ) : (
                        available
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isBlocked ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Open
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={isBlocked ? "outline" : "destructive"}
                        disabled={isPending}
                        onClick={() => handleToggleBlock(dStr, !isBlocked)}
                      >
                        {isBlocked ? "Unblock Date" : "Block Date"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Affected Bookings Confirmation Modal */}
      {affectedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-destructive">
              Confirm Date Blocking ({affectedModal.date})
            </h3>
            <p className="text-sm text-muted-foreground">
              Blocking this date impacts{" "}
              <strong>{affectedModal.affectedBookings.length}</strong> active booking(s):
            </p>
            <div className="max-h-40 overflow-y-auto divide-y divide-border rounded border border-border bg-muted/20 p-2 text-xs">
              {affectedModal.affectedBookings.map((b) => (
                <div key={b.id} className="py-1">
                  <div className="font-semibold text-forest-900">{b.reference}</div>
                  <div className="text-muted-foreground">
                    Guest: {b.contactName} ({b.status})
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to block this date despite active bookings?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAffectedModal(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => handleToggleBlock(affectedModal.date, true, true)}
              >
                Yes, Force Block Date
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Blackout Period Modal */}
      {showBlackoutModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">
              Add Farm Blackout Period
            </h3>
            <p className="text-xs text-muted-foreground">
              Caps at 366 days. Completely blocks all bookings across the farm during this window.
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Start Date
                </label>
                <Input
                  type="date"
                  className="mt-1"
                  value={blackoutStart}
                  onChange={(e) => setBlackoutStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  End Date
                </label>
                <Input
                  type="date"
                  className="mt-1"
                  value={blackoutEnd}
                  onChange={(e) => setBlackoutEnd(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Closure Reason
                </label>
                <Input
                  className="mt-1"
                  placeholder="Monsoon maintenance / Private event closure"
                  value={blackoutReason}
                  onChange={(e) => setBlackoutReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowBlackoutModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-forest-800 text-white hover:bg-forest-900"
                disabled={isPending}
                onClick={handleCreateBlackout}
              >
                Create Blackout
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
