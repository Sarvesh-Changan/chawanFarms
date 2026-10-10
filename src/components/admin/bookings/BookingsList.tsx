"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

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

export type BookingListItem = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  checkIn: Date | string;
  checkOut: Date | string;
  nights: number;
  adults: number;
  children4to10: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  totalPaise: number;
  amountPaidPaise: number;
  package?: { id: string; name: unknown; slug: string } | null;
  accommodation?: { id: string; name: unknown; slug: string } | null;
  createdAt: Date | string;
};

type BookingsListProps = {
  bookings: BookingListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function BookingsList({
  bookings,
  totalCount,
  page,
  totalPages,
}: BookingsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilters = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val === null || val === "" || val === "ALL") {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      }
      if (!updates.page) {
        params.set("page", "1");
      }
      startTransition(() => {
        router.push(`/admin/bookings?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  const status = searchParams.get("status") || "ALL";
  const paymentStatus = searchParams.get("paymentStatus") || "ALL";
  const search = searchParams.get("search") || "";
  const checkInFrom = searchParams.get("checkInFrom") || "";
  const checkInTo = searchParams.get("checkInTo") || "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        eyebrow="Reservations Management"
        description="Review booking requests, track offline payments, and manage reservations."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/calendar">Arrivals & Calendar</Link>
            </Button>
            <Button asChild className="bg-forest-800 text-white hover:bg-forest-900">
              <Link href="/admin/bookings/new">+ New Manual Booking</Link>
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 md:grid-cols-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Search
          </label>
          <Input
            placeholder="Ref, name, phone, email..."
            defaultValue={search}
            className="mt-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilters({ search: e.currentTarget.value.trim() });
              }
            }}
            onBlur={(e) => {
              if (e.currentTarget.value !== search) {
                updateFilters({ search: e.currentTarget.value.trim() });
              }
            }}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Booking Status
          </label>
          <Select
            value={status}
            onValueChange={(val) => updateFilters({ status: val })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING_CONFIRMATION">Pending Confirmation</SelectItem>
              <SelectItem value="ENQUIRY">Enquiry (Manual Quote)</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="NO_SHOW">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Payment Status
          </label>
          <Select
            value={paymentStatus}
            onValueChange={(val) => updateFilters({ paymentStatus: val })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All Payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Payments</SelectItem>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
              <SelectItem value="PAID">Paid (100%)</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
              <SelectItem value="PARTIALLY_REFUNDED">Partially Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Check-In From
          </label>
          <Input
            type="date"
            className="mt-1"
            value={checkInFrom}
            onChange={(e) => updateFilters({ checkInFrom: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Check-In To
          </label>
          <Input
            type="date"
            className="mt-1"
            value={checkInTo}
            onChange={(e) => updateFilters({ checkInTo: e.target.value })}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Stay Dates</th>
                <th className="px-4 py-3">Package / Units</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {isPending ? "Loading bookings..." : "No bookings match the selected filters."}
                  </td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const checkInStr =
                    typeof b.checkIn === "string"
                      ? b.checkIn.slice(0, 10)
                      : b.checkIn.toISOString().slice(0, 10);
                  const checkOutStr =
                    typeof b.checkOut === "string"
                      ? b.checkOut.slice(0, 10)
                      : b.checkOut.toISOString().slice(0, 10);
                  const isDayVisit = checkInStr === checkOutStr || b.nights === 0;

                  return (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono font-medium text-forest-900">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="text-laterite-700 hover:underline"
                        >
                          {b.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{b.contactName}</div>
                        <div className="text-xs text-muted-foreground">{b.contactPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          {checkInStr} → {checkOutStr}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isDayVisit ? (
                            <span className="font-semibold text-amber-700">Day Visit</span>
                          ) : (
                            `${b.nights} night(s)`
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">
                          {b.package ? (typeof b.package.name === "object" ? JSON.stringify(b.package.name) : String(b.package.name)) : "Standard"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.adults} adult(s)
                          {b.children4to10 > 0 ? `, ${b.children4to10} kid(s)` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          ₹{(b.totalPaise / 100).toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Paid: ₹{(b.amountPaidPaise / 100).toLocaleString("en-IN")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={b.status} />
                          <StatusBadge status={b.paymentStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/bookings/${b.id}`}>Manage</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing {bookings.length} of {totalCount} reservations (Page {page} of{" "}
            {Math.max(1, totalPages)})
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || isPending}
              onClick={() => updateFilters({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || isPending}
              onClick={() => updateFilters({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
