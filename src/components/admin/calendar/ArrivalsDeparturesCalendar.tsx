"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CalendarEvent = {
  id: string;
  reference: string;
  contactName: string;
  contactPhone: string;
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children4to10: number;
  totalGuests: number;
  isDayVisit: boolean;
  packageName?: unknown;
  accommodationName?: unknown;
};

type ArrivalsDeparturesCalendarProps = {
  events: CalendarEvent[];
  startDate: string;
  endDate: string;
};

export function ArrivalsDeparturesCalendar({
  events,
  startDate,
  endDate,
}: ArrivalsDeparturesCalendarProps) {
  const router = useRouter();
  const [filterType, setFilterType] = useState<"ALL" | "ARRIVALS" | "DEPARTURES" | "DAY_VISITS">("ALL");

  function handleNavigateRange(newStart: string, newEnd: string) {
    router.push(`/admin/calendar?startDate=${newStart}&endDate=${newEnd}`);
  }

  // Shift range by 14 days
  function handlePrev() {
    const s = new Date(`${startDate}T00:00:00.000Z`);
    const e = new Date(`${endDate}T00:00:00.000Z`);
    s.setUTCDate(s.getUTCDate() - 14);
    e.setUTCDate(e.getUTCDate() - 14);
    handleNavigateRange(s.toISOString().slice(0, 10), e.toISOString().slice(0, 10));
  }

  function handleNext() {
    const s = new Date(`${startDate}T00:00:00.000Z`);
    const e = new Date(`${endDate}T00:00:00.000Z`);
    s.setUTCDate(s.getUTCDate() + 14);
    e.setUTCDate(e.getUTCDate() + 14);
    handleNavigateRange(s.toISOString().slice(0, 10), e.toISOString().slice(0, 10));
  }

  // Generate date list
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
        title="Arrivals & Departures"
        eyebrow="Farm Operations Calendar"
        description="Day-by-day guest arrivals, departures, and day-visits in Asia/Kolkata local time."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/bookings">All Bookings</Link>
            </Button>
            <Button asChild className="bg-forest-800 text-white hover:bg-forest-900">
              <Link href="/admin/bookings/new">+ New Booking</Link>
            </Button>
          </div>
        }
      />

      {/* Date Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrev}>
            ← Previous 14 Days
          </Button>
          <span className="font-mono text-sm font-semibold">
            {startDate} → {endDate}
          </span>
          <Button size="sm" variant="outline" onClick={handleNext}>
            Next 14 Days →
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Filter View:</label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filterType === "ALL" ? "default" : "outline"}
              className={filterType === "ALL" ? "bg-forest-800 text-white" : ""}
              onClick={() => setFilterType("ALL")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filterType === "ARRIVALS" ? "default" : "outline"}
              className={filterType === "ARRIVALS" ? "bg-forest-800 text-white" : ""}
              onClick={() => setFilterType("ARRIVALS")}
            >
              Arrivals
            </Button>
            <Button
              size="sm"
              variant={filterType === "DEPARTURES" ? "default" : "outline"}
              className={filterType === "DEPARTURES" ? "bg-forest-800 text-white" : ""}
              onClick={() => setFilterType("DEPARTURES")}
            >
              Departures
            </Button>
            <Button
              size="sm"
              variant={filterType === "DAY_VISITS" ? "default" : "outline"}
              className={filterType === "DAY_VISITS" ? "bg-forest-800 text-white" : ""}
              onClick={() => setFilterType("DAY_VISITS")}
            >
              Day Visits
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={startDate}
            onChange={(e) => handleNavigateRange(e.target.value, endDate)}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={endDate}
            onChange={(e) => handleNavigateRange(startDate, e.target.value)}
          />
        </div>
      </div>

      {/* Date-by-date schedule */}
      <div className="space-y-4">
        {dateList.map((dStr) => {
          const dayDate = new Date(`${dStr}T00:00:00.000Z`);
          const weekday = dayDate.toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

          // Match arrivals, departures, day visits
          const arrivals = events.filter((e) => e.checkIn === dStr && !e.isDayVisit);
          const departures = events.filter((e) => e.checkOut === dStr && !e.isDayVisit);
          const dayVisits = events.filter((e) => e.checkIn === dStr && e.isDayVisit);

          const hasArrivals = filterType === "ALL" || filterType === "ARRIVALS";
          const hasDepartures = filterType === "ALL" || filterType === "DEPARTURES";
          const hasDayVisits = filterType === "ALL" || filterType === "DAY_VISITS";

          const totalActivity =
            (hasArrivals ? arrivals.length : 0) +
            (hasDepartures ? departures.length : 0) +
            (hasDayVisits ? dayVisits.length : 0);

          return (
            <div
              key={dStr}
              className={`rounded-lg border border-border bg-card p-4 transition-colors ${
                totalActivity > 0 ? "border-l-4 border-l-forest-700" : "opacity-80"
              }`}
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-base font-bold text-forest-900">{dStr}</span>
                  <span className="text-sm font-medium text-muted-foreground">{weekday}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {totalActivity === 0
                    ? "No scheduled arrivals / departures"
                    : `${totalActivity} reservation(s)`}
                </div>
              </div>

              {totalActivity === 0 ? null : (
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Arrivals Column */}
                  {hasArrivals ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                        <span>📥 Arrivals ({arrivals.length})</span>
                      </div>
                      {arrivals.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">None</p>
                      ) : (
                        arrivals.map((e) => (
                          <div
                            key={`arr-${e.id}`}
                            className="rounded border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs space-y-1"
                          >
                            <div className="flex justify-between items-center">
                              <Link
                                href={`/admin/bookings/${e.id}`}
                                className="font-semibold text-emerald-900 hover:underline"
                              >
                                {e.reference}
                              </Link>
                              <StatusBadge status={e.status} />
                            </div>
                            <div className="font-medium text-foreground">{e.contactName}</div>
                            <div className="text-muted-foreground">
                              {e.totalGuests} guests · {e.nights} night(s)
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}

                  {/* Departures Column */}
                  {hasDepartures ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1">
                        <span>📤 Departures ({departures.length})</span>
                      </div>
                      {departures.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">None</p>
                      ) : (
                        departures.map((e) => (
                          <div
                            key={`dep-${e.id}`}
                            className="rounded border border-blue-200 bg-blue-50/50 p-2.5 text-xs space-y-1"
                          >
                            <div className="flex justify-between items-center">
                              <Link
                                href={`/admin/bookings/${e.id}`}
                                className="font-semibold text-blue-900 hover:underline"
                              >
                                {e.reference}
                              </Link>
                              <StatusBadge status={e.status} />
                            </div>
                            <div className="font-medium text-foreground">{e.contactName}</div>
                            <div className="text-muted-foreground">
                              {e.totalGuests} guests · Checked in {e.checkIn}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}

                  {/* Day Visits Column */}
                  {hasDayVisits ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                        <span>☀️ Day Visits / Picnics ({dayVisits.length})</span>
                      </div>
                      {dayVisits.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">None</p>
                      ) : (
                        dayVisits.map((e) => (
                          <div
                            key={`day-${e.id}`}
                            className="rounded border border-amber-200 bg-amber-50/50 p-2.5 text-xs space-y-1"
                          >
                            <div className="flex justify-between items-center">
                              <Link
                                href={`/admin/bookings/${e.id}`}
                                className="font-semibold text-amber-900 hover:underline"
                              >
                                {e.reference}
                              </Link>
                              <StatusBadge status={e.status} />
                            </div>
                            <div className="font-medium text-foreground">{e.contactName}</div>
                            <div className="text-muted-foreground">
                              {e.totalGuests} guests · Same-day picnic
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
