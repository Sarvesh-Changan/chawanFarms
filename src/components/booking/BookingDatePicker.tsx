"use client";

import { useCallback, useEffect, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

import {
  formatDateDDMMYYYY,
  formatDateYYYYMMDD,
  isoToDisplayDate,
  parseDateDDMMYYYY,
} from "@/lib/booking-dates";

export type BookingDatePickerProps = {
  mode: "single" | "range";
  checkInIso: string;
  checkOutIso: string;
  minDate: Date;
  maxDate?: Date;
  accommodationSlug?: string | null;
  onDatesChange: (checkInIso: string, checkOutIso: string) => void;
  disabled?: boolean;
};

export function BookingDatePicker({
  mode,
  checkInIso,
  checkOutIso,
  minDate,
  maxDate,
  accommodationSlug,
  onDatesChange,
  disabled = false,
}: BookingDatePickerProps) {
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [typedCheckIn, setTypedCheckIn] = useState<string | null>(null);
  const [typedCheckOut, setTypedCheckOut] = useState<string | null>(null);
  const [typedError, setTypedError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState<boolean>(true);

  const displayCheckIn = typedCheckIn !== null ? typedCheckIn : isoToDisplayDate(checkInIso);
  const displayCheckOut = typedCheckOut !== null ? typedCheckOut : isoToDisplayDate(checkOutIso);

  // Fetch availability when accommodationSlug or month range changes
  useEffect(() => {
    let isCancelled = false;
    async function loadAvailability() {
      if (!accommodationSlug) {
        return;
      }
      try {
        const fromStr = formatDateYYYYMMDD(minDate);
        const to = new Date(minDate);
        to.setDate(to.getDate() + 90); // Next 90 days
        const toStr = formatDateYYYYMMDD(to);

        const res = await fetch(
          `/api/availability?accommodationSlug=${encodeURIComponent(
            accommodationSlug,
          )}&checkIn=${fromStr}&checkOut=${toStr}`,
        );
        if (res.ok && !isCancelled) {
          const data = (await res.json()) as {
            breakdown?: Array<{ date: string; available: boolean; status: string }>;
          };
          if (Array.isArray(data.breakdown)) {
            const blocked = new Set<string>();
            for (const item of data.breakdown) {
              if (!item.available || item.status === "BLOCKED" || item.status === "SOLD_OUT") {
                blocked.add(item.date);
              }
            }
            setBlockedDates(blocked);
          }
        }
      } catch {
        // Degrade gracefully if availability check fails
      }
    }

    void loadAvailability();
    return () => {
      isCancelled = true;
    };
  }, [accommodationSlug, minDate]);

  // Handle DayPicker selection in single mode
  const handleSingleSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      const iso = formatDateYYYYMMDD(date);
      setTypedError(null);
      setTypedCheckIn(null);
      setTypedCheckOut(null);
      onDatesChange(iso, iso);
    },
    [onDatesChange],
  );

  // Handle DayPicker selection in range mode
  const handleRangeSelect = useCallback(
    (range: DateRange | undefined) => {
      if (!range) return;
      const fromIso = range.from ? formatDateYYYYMMDD(range.from) : "";
      const toIso = range.to ? formatDateYYYYMMDD(range.to) : fromIso;
      setTypedError(null);
      setTypedCheckIn(null);
      setTypedCheckOut(null);
      if (fromIso) {
        onDatesChange(fromIso, toIso || fromIso);
      }
    },
    [onDatesChange],
  );

  // Manual input commit for check-in
  const handleTypedCheckInBlur = () => {
    if (typedCheckIn === null) return;
    if (!typedCheckIn.trim()) {
      setTypedCheckIn(null);
      return;
    }
    const parsed = parseDateDDMMYYYY(typedCheckIn);
    if (!parsed) {
      setTypedError("Please enter a valid check-in date in DD/MM/YYYY format.");
      return;
    }
    if (parsed < minDate) {
      setTypedError(`Check-in cannot be before ${formatDateDDMMYYYY(minDate)}.`);
      return;
    }
    if (maxDate && parsed > maxDate) {
      setTypedError(`Check-in cannot be after ${formatDateDDMMYYYY(maxDate)}.`);
      return;
    }
    const iso = formatDateYYYYMMDD(parsed);
    setTypedError(null);
    setTypedCheckIn(null);
    if (mode === "single") {
      onDatesChange(iso, iso);
    } else {
      // If current checkOut is before new checkIn, bump checkOut to match checkIn
      if (checkOutIso && checkOutIso < iso) {
        onDatesChange(iso, iso);
      } else {
        onDatesChange(iso, checkOutIso || iso);
      }
    }
  };

  // Manual input commit for check-out
  const handleTypedCheckOutBlur = () => {
    if (mode === "single" || typedCheckOut === null) return;
    if (!typedCheckOut.trim()) {
      setTypedCheckOut(null);
      return;
    }
    const parsed = parseDateDDMMYYYY(typedCheckOut);
    if (!parsed) {
      setTypedError("Please enter a valid check-out date in DD/MM/YYYY format.");
      return;
    }
    const iso = formatDateYYYYMMDD(parsed);
    if (checkInIso && iso < checkInIso) {
      setTypedError("Check-out date cannot be earlier than check-in date.");
      return;
    }
    setTypedError(null);
    setTypedCheckOut(null);
    onDatesChange(checkInIso, iso);
  };

  // Disabled dates matcher for react-day-picker
  const isDateDisabled = (date: Date): boolean => {
    // Before minDate
    const dateAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const minAtMidnight = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    if (dateAtMidnight < minAtMidnight) return true;

    // After maxDate
    if (maxDate) {
      const maxAtMidnight = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
      if (dateAtMidnight > maxAtMidnight) return true;
    }

    // Blocked from server
    const iso = formatDateYYYYMMDD(date);
    if (blockedDates.has(iso)) return true;

    return false;
  };

  // Parse current selected state for react-day-picker
  const selectedSingle = checkInIso ? new Date(checkInIso + "T00:00:00") : undefined;
  const selectedRange: DateRange | undefined =
    checkInIso && checkOutIso
      ? {
          from: new Date(checkInIso + "T00:00:00"),
          to: new Date(checkOutIso + "T00:00:00"),
        }
      : undefined;

  return (
    <div className="space-y-4">
      {/* Typed Input Controls (Accessible Primary / Fallback) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="booking-checkin-input"
            className="block text-sm font-semibold text-forest-900"
          >
            {mode === "single" ? "Visit date (DD/MM/YYYY)" : "Check-in date (DD/MM/YYYY)"}
          </label>
          <div className="relative mt-1">
            <input
              id="booking-checkin-input"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={displayCheckIn}
              disabled={disabled}
              onChange={(e) => setTypedCheckIn(e.target.value)}
              onBlur={handleTypedCheckInBlur}
              pattern="\d{2}/\d{2}/\d{4}"
              className="w-full min-h-[44px] rounded-lg border border-forest-900/30 bg-background px-3.5 py-2 text-base text-forest-900 placeholder:text-muted-foreground focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-700/20"
              aria-describedby="date-format-hint"
            />
          </div>
        </div>

        {mode === "range" && (
          <div>
            <label
              htmlFor="booking-checkout-input"
              className="block text-sm font-semibold text-forest-900"
            >
              Check-out date (DD/MM/YYYY)
            </label>
            <div className="relative mt-1">
              <input
                id="booking-checkout-input"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={displayCheckOut}
                disabled={disabled}
                onChange={(e) => setTypedCheckOut(e.target.value)}
                onBlur={handleTypedCheckOutBlur}
                pattern="\d{2}/\d{2}/\d{4}"
                className="w-full min-h-[44px] rounded-lg border border-forest-900/30 bg-background px-3.5 py-2 text-base text-forest-900 placeholder:text-muted-foreground focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-700/20"
                aria-describedby="date-format-hint"
              />
            </div>
          </div>
        )}
      </div>

      <p id="date-format-hint" className="text-xs text-muted-foreground">
        Enter dates as Day/Month/Year (e.g. {formatDateDDMMYYYY(minDate)}) or select directly from the calendar below.
      </p>

      {typedError && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive font-medium">
          {typedError}
        </div>
      )}

      {/* Calendar toggle for compact views */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowCalendar((prev) => !prev)}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 underline focus:outline-none focus:ring-2 focus:ring-forest-700/30 rounded px-1"
          aria-expanded={showCalendar}
          aria-controls="booking-calendar-container"
        >
          {showCalendar ? "Hide calendar view" : "Show calendar view"}
        </button>
      </div>

      {/* Calendar View using react-day-picker v10 */}
      {showCalendar && (
        <div
          id="booking-calendar-container"
          className="rounded-xl border border-forest-900/15 bg-white p-4 shadow-sm inline-block max-w-full overflow-x-auto"
        >
          <div className="flex items-center justify-between pb-3 text-xs text-muted-foreground border-b border-border mb-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-forest-700" aria-hidden="true" />
              Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-destructive/60" aria-hidden="true" />
              Unavailable / Blocked
            </span>
          </div>

          {mode === "single" ? (
            <DayPicker
              mode="single"
              selected={selectedSingle}
              onSelect={handleSingleSelect}
              disabled={isDateDisabled}
              timeZone="Asia/Kolkata"
              className="daypicker-custom"
            />
          ) : (
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={handleRangeSelect}
              disabled={isDateDisabled}
              timeZone="Asia/Kolkata"
              className="daypicker-custom"
            />
          )}
        </div>
      )}
    </div>
  );
}
