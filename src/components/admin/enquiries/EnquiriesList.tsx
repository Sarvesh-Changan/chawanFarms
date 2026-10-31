"use client";

import {
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLeadStatusAction } from "@/server/actions/leads-crm";
import type { AdminEnquiriesResult, AdminEnquiryItem } from "@/server/services/admin-enquiries";

function formatDate(val: Date | string | null | undefined): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function formatDateTime(val: Date | string | null | undefined): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function getLocalizedText(val: unknown, fallback: string): string {
  if (!val) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    const record = val as Record<string, unknown>;
    const text = record.en || record.mr || record.hi || Object.values(record)[0];
    if (typeof text === "string" && text.trim()) return text;
  }
  return fallback;
}

function cleanPhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/[^0-9]/g, "");
}

function typeBadge(type: string) {
  switch (type) {
    case "PACKAGE":
      return <Badge className="bg-forest-900 text-cream-50 hover:bg-forest-800">Package</Badge>;
    case "ACTIVITY":
      return <Badge className="bg-leaf-500 text-cream-50 hover:bg-leaf-500/90">Activity</Badge>;
    case "CAMP_ORGANISER":
      return <Badge className="bg-turmeric-500 text-ink-900 hover:bg-turmeric-500/90">Camp</Badge>;
    case "SCHOOL_GROUP":
      return <Badge className="bg-turmeric-500 text-ink-900 hover:bg-turmeric-500/90">School</Badge>;
    case "CONTACT_FORM":
      return <Badge variant="outline" className="border-laterite-600/40 text-laterite-600">Contact</Badge>;
    default:
      return <Badge variant="outline">{type.toLowerCase().replaceAll("_", " ")}</Badge>;
  }
}

export function EnquiriesList({
  data,
  canWrite = true,
}: {
  data: AdminEnquiriesResult;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedEnquiry, setSelectedEnquiry] = useState<AdminEnquiryItem | null>(null);
  const [isUpdatingStatus, startStatusTransition] = useTransition();

  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "ALL";
  const status = searchParams.get("status") || "ALL";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";

  function updateFilters(newFilters: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    for (const [key, value] of Object.entries(newFilters)) {
      if (value === undefined || value === "" || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    router.push(`/admin/enquiries?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/enquiries?${params.toString()}`);
  }

  function handleStatusChange(enquiry: AdminEnquiryItem, newStatus: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "CLOSED") {
    startStatusTransition(async () => {
      const res = await updateLeadStatusAction({
        leadId: enquiry.lead.id,
        status: newStatus,
      });

      if (!res.ok) {
        toast.error(res.error?.message || "Failed to update lead status");
      } else {
        toast.success(`Lead status updated to ${newStatus}`);
        if (selectedEnquiry && selectedEnquiry.id === enquiry.id) {
          setSelectedEnquiry({
            ...selectedEnquiry,
            lead: { ...selectedEnquiry.lead, status: newStatus },
          });
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        eyebrow="Guest Inquiries & Leads"
        description="Review inbound messages, quote requests, and potential stay inquiries."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/leads">
                <Users className="size-4 mr-1.5" />
                View CRM Leads
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
              title="Refresh list"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Total Inquiries</p>
          <p className="font-heading mt-2 text-3xl text-forest-900">{data.summary.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">All logged submissions</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Action Needed</p>
          <p className="font-heading mt-2 text-3xl text-turmeric-500 font-bold">{data.summary.newCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">New leads requiring follow-up</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Package Requests</p>
          <p className="font-heading mt-2 text-3xl text-forest-900">{data.summary.packages}</p>
          <p className="mt-1 text-xs text-muted-foreground">Farm stay packages</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">School & Groups</p>
          <p className="font-heading mt-2 text-3xl text-forest-900">{data.summary.groups}</p>
          <p className="mt-1 text-xs text-muted-foreground">Organised group visits</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Search
          </label>
          <div className="relative mt-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Ref, name, phone, email..."
              defaultValue={search}
              className="pl-9"
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
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Enquiry Type
          </label>
          <Select
            value={type}
            onValueChange={(val) => updateFilters({ type: val })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="GENERAL">General</SelectItem>
              <SelectItem value="PACKAGE">Package</SelectItem>
              <SelectItem value="ACTIVITY">Activity</SelectItem>
              <SelectItem value="ACCOMMODATION">Accommodation</SelectItem>
              <SelectItem value="CAMP_ORGANISER">Camp Organiser</SelectItem>
              <SelectItem value="SCHOOL_GROUP">School Group</SelectItem>
              <SelectItem value="CONTACT_FORM">Contact Form</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Lead Status
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
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="CONTACTED">Contacted</SelectItem>
              <SelectItem value="QUALIFIED">Qualified</SelectItem>
              <SelectItem value="CONVERTED">Converted</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Received From
          </label>
          <Input
            type="date"
            className="mt-1"
            value={dateFrom}
            onChange={(e) => updateFilters({ dateFrom: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Received To
          </label>
          <div className="flex gap-2">
            <Input
              type="date"
              className="mt-1 flex-1"
              value={dateTo}
              onChange={(e) => updateFilters({ dateTo: e.target.value })}
            />
            {search || type !== "ALL" || status !== "ALL" || dateFrom || dateTo ? (
              <Button
                variant="ghost"
                size="icon"
                className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                title="Reset filters"
                onClick={() => router.push("/admin/enquiries")}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Enquiries Table */}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/80 bg-muted/40 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3.5">Reference</th>
                <th className="px-4 py-3.5">Guest</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Subject / Message</th>
                <th className="px-4 py-3.5">Preferred Dates</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.enquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <MessageSquare className="mx-auto size-8 text-muted-foreground/60 mb-2" />
                    <p className="font-medium text-foreground">No enquiries found</p>
                    <p className="text-xs mt-1">Try adjusting your search or clearing active filters.</p>
                  </td>
                </tr>
              ) : (
                data.enquiries.map((item) => {
                  const guestName = item.lead.name || "Anonymous Guest";
                  const subject = item.package
                    ? `Package: ${getLocalizedText(item.package.name, item.package.slug)}`
                    : item.activity
                      ? `Activity: ${getLocalizedText(item.activity.name, item.activity.slug)}`
                      : item.accommodation
                        ? `Accommodation: ${getLocalizedText(item.accommodation.name, item.accommodation.slug)}`
                        : item.message
                          ? item.message
                          : "General inquiry";

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedEnquiry(item)}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-forest-900 block">
                          {item.reference}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{guestName}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {item.lead.phone ? (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Phone className="size-3 text-mist-500" />
                              {item.lead.phone}
                            </span>
                          ) : null}
                          {item.lead.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="size-3 text-mist-500" />
                              {item.lead.email}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {typeBadge(item.type)}
                      </td>

                      <td className="px-4 py-3.5 max-w-xs truncate text-muted-foreground">
                        <span className="text-foreground font-medium block truncate">
                          {subject}
                        </span>
                        {item.message && subject !== item.message ? (
                          <span className="text-xs text-muted-foreground truncate block">
                            &ldquo;{item.message}&rdquo;
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        {item.preferredStart ? (
                          <div className="font-medium text-foreground">
                            {formatDate(item.preferredStart)}
                            {item.preferredEnd ? ` – ${formatDate(item.preferredEnd)}` : ""}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Dates flexible</span>
                        )}
                        {item.groupSize ? (
                          <div className="text-muted-foreground text-[11px] mt-0.5">
                            Group: {item.groupSize} {item.groupSize === 1 ? "person" : "guests"}
                          </div>
                        ) : item.adults ? (
                          <div className="text-muted-foreground text-[11px] mt-0.5">
                            {item.adults} adult(s)
                            {item.children ? `, ${item.children} child(ren)` : ""}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={item.lead.status} />
                      </td>

                      <td
                        className="px-4 py-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedEnquiry(item)}
                          >
                            View
                          </Button>
                          <Button asChild variant="ghost" size="xs">
                            <Link href={`/admin/leads/${item.lead.id}`} title="Open in CRM">
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 px-4 py-3 text-xs text-muted-foreground">
            <div>
              Showing page <span className="font-medium text-foreground">{data.page}</span> of{" "}
              <span className="font-medium text-foreground">{data.totalPages}</span> ({data.totalCount} total)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => handlePageChange(data.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => handlePageChange(data.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Enquiry Details Modal */}
      {selectedEnquiry ? (
        <Dialog open={Boolean(selectedEnquiry)} onOpenChange={(open) => !open && setSelectedEnquiry(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3 pr-6">
                <div>
                  <DialogTitle className="font-heading text-2xl text-forest-900">
                    Enquiry {selectedEnquiry.reference}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs">
                    Received on {formatDateTime(selectedEnquiry.createdAt)}
                  </DialogDescription>
                </div>
                <div className="flex gap-1.5">
                  {typeBadge(selectedEnquiry.type)}
                  <StatusBadge status={selectedEnquiry.lead.status} />
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Guest Details */}
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Guest Contact
                </p>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-base text-foreground">
                      {selectedEnquiry.lead.name || "Anonymous Guest"}
                    </p>
                    {selectedEnquiry.lead.phone ? (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {selectedEnquiry.lead.phone}
                      </p>
                    ) : null}
                    {selectedEnquiry.lead.email ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedEnquiry.lead.email}
                      </p>
                    ) : null}
                  </div>

                  {/* Direct Contact CTAs */}
                  <div className="flex flex-wrap gap-2">
                    {selectedEnquiry.lead.phone ? (
                      <>
                        <Button asChild size="xs" variant="outline">
                          <a href={`tel:${selectedEnquiry.lead.phone}`}>
                            <Phone className="size-3 mr-1" />
                            Call
                          </a>
                        </Button>
                        <Button asChild size="xs" className="bg-emerald-700 text-white hover:bg-emerald-800">
                          <a
                            href={`https://wa.me/${cleanPhoneForWhatsApp(selectedEnquiry.lead.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            WhatsApp
                          </a>
                        </Button>
                      </>
                    ) : null}
                    {selectedEnquiry.lead.email ? (
                      <Button asChild size="xs" variant="outline">
                        <a href={`mailto:${selectedEnquiry.lead.email}`}>
                          <Mail className="size-3 mr-1" />
                          Email
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Inquiry Request Specifics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground block font-medium">Preferred Stay</span>
                  <span className="font-medium text-foreground block mt-1 text-sm">
                    {selectedEnquiry.preferredStart ? (
                      <>
                        {formatDate(selectedEnquiry.preferredStart)}
                        {selectedEnquiry.preferredEnd ? ` to ${formatDate(selectedEnquiry.preferredEnd)}` : ""}
                      </>
                    ) : (
                      "Flexible / Not specified"
                    )}
                  </span>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground block font-medium">Group Size</span>
                  <span className="font-medium text-foreground block mt-1 text-sm">
                    {selectedEnquiry.groupSize ? (
                      `${selectedEnquiry.groupSize} Guests`
                    ) : selectedEnquiry.adults ? (
                      `${selectedEnquiry.adults} Adults${selectedEnquiry.children ? `, ${selectedEnquiry.children} Children` : ""}${selectedEnquiry.infants ? `, ${selectedEnquiry.infants} Infants` : ""}`
                    ) : (
                      "Not specified"
                    )}
                  </span>
                </div>
              </div>

              {/* Package / Activity details if present */}
              {selectedEnquiry.package ? (
                <div className="rounded-lg border border-border p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium block">Requested Package</span>
                    <span className="font-semibold text-foreground text-sm">
                      {getLocalizedText(selectedEnquiry.package.name, selectedEnquiry.package.slug)}
                    </span>
                  </div>
                  <Button asChild size="xs" variant="outline">
                    <Link href={`/packages/${selectedEnquiry.package.slug}`} target="_blank">
                      View Package
                    </Link>
                  </Button>
                </div>
              ) : null}

              {selectedEnquiry.activity ? (
                <div className="rounded-lg border border-border p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium block">Requested Activity</span>
                    <span className="font-semibold text-foreground text-sm">
                      {getLocalizedText(selectedEnquiry.activity.name, selectedEnquiry.activity.slug)}
                    </span>
                  </div>
                  <Button asChild size="xs" variant="outline">
                    <Link href={`/activities/${selectedEnquiry.activity.slug}`} target="_blank">
                      View Activity
                    </Link>
                  </Button>
                </div>
              ) : null}

              {/* Message */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Message / Special Request
                </p>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {selectedEnquiry.message || "No additional message was provided."}
                </p>
              </div>

              {/* Lead Pipeline Quick Status Update */}
              {canWrite ? (
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
                  <div>
                    <span className="font-semibold text-foreground block">Pipeline Status</span>
                    <span className="text-muted-foreground">Update lead status for follow-up</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedEnquiry.lead.status}
                      disabled={isUpdatingStatus}
                      onValueChange={(val: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "CLOSED") =>
                        handleStatusChange(selectedEnquiry, val)
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW">New</SelectItem>
                        <SelectItem value="CONTACTED">Contacted</SelectItem>
                        <SelectItem value="QUALIFIED">Qualified</SelectItem>
                        <SelectItem value="CONVERTED">Converted</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/leads/${selectedEnquiry.lead.id}`}>
                  <Users className="size-3.5 mr-1.5" />
                  Open in CRM
                </Link>
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedEnquiry(null)}>
                  Close
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-forest-900 text-cream-50 hover:bg-forest-700 font-semibold shadow-sm"
                >
                  <Link
                    href={`/admin/bookings/new?leadId=${selectedEnquiry.lead.id}&contactName=${encodeURIComponent(selectedEnquiry.lead.name || "")}&contactPhone=${encodeURIComponent(selectedEnquiry.lead.phone || "")}&contactEmail=${encodeURIComponent(selectedEnquiry.lead.email || "")}`}
                  >
                    Convert to Booking
                  </Link>
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
