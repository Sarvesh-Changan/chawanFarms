import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadDetailControls } from "@/components/admin/leads/LeadDetailControls";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { canEditLeadScope } from "@/server/policies/leadStatus";
import { getLeadDetail } from "@/server/services/leads-crm";

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff) return <NoAccess title="Staff access required" />;
  try { await requirePermission("leads.read"); }
  catch (error) { return <NoAccess title={error instanceof AuthorizationError && !staff.twoFactorEnabled ? "Set up two-factor authentication" : "Lead access required"} />; }
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();
  const [canWrite, canAssign] = await Promise.all([can(staff, "leads.write"), can(staff, "leads.assign")]);
  const canEdit = canEditLeadScope({ assignedToId: lead.assignedToId, actorId: staff.id, canAssign });
  const title = lead.name?.trim() || "Unnamed lead";
  return <div className="space-y-6">
    <PageHeader eyebrow="Lead record" title={title} description={`Created ${lead.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`} actions={<Button asChild variant="outline"><Link href="/admin/leads">Back to leads</Link></Button>} />
    {!canEdit && canWrite ? <p role="status" className="rounded-lg border border-border bg-muted/50 p-3 text-sm">This lead is assigned to another staff member. You can view it but cannot edit it.</p> : null}
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-xl border border-border/70 bg-card p-5"><h2 className="font-semibold">Contact and pipeline</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Phone</dt><dd className="mt-1"><a href={lead.phone ? `tel:${lead.phone}` : undefined}>{lead.phone ?? "Not provided"}</a></dd></div>
        <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1"><a href={lead.email ? `mailto:${lead.email}` : undefined}>{lead.email ?? "Not provided"}</a></dd></div>
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1 flex items-center gap-2"><StatusBadge status={lead.status} />{lead.closeReason ? <span className="text-xs text-muted-foreground">{lead.closeReason.replaceAll("_", " ")}</span> : null}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Source</dt><dd className="mt-1">{lead.source ?? "Unknown"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Assignee</dt><dd className="mt-1">{lead.assignedTo?.name ?? "Unassigned"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Follow-up due</dt><dd className="mt-1">{lead.followUpAt?.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "Not set"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">First touch</dt><dd className="mt-1 break-all text-sm">{[lead.firstUtmSource, lead.firstUtmMedium, lead.firstUtmCampaign].filter(Boolean).join(" / ") || "No attribution"}{lead.firstLandingPath ? <span className="block text-xs text-muted-foreground">{lead.firstLandingPath}</span> : null}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Latest touch</dt><dd className="mt-1 break-all text-sm">{[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" / ") || "No attribution"}{lead.lastLandingPath ? <span className="block text-xs text-muted-foreground">{lead.lastLandingPath}</span> : null}</dd></div>
      </dl></div>
      <aside className="rounded-xl border border-border/70 bg-card p-5"><h2 className="font-semibold">Linked bookings</h2>{lead.bookings.length ? <ul className="mt-3 space-y-3">{lead.bookings.map((booking) => <li key={booking.id} className="border-t border-border pt-3"><Link className="font-semibold text-forest-900 underline" href={`/admin/bookings?reference=${encodeURIComponent(booking.reference)}`}>{booking.reference}</Link><p className="mt-1 text-xs">{booking.status} · {booking.checkIn.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} – {booking.checkOut.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No bookings linked yet.</p>}
        <h2 className="mt-6 font-semibold">Enquiries</h2>{lead.enquiries.length ? <ul className="mt-3 space-y-3">{lead.enquiries.map((enquiry) => <li key={enquiry.id} className="border-t border-border pt-3"><p className="font-medium">{enquiry.reference} · {enquiry.type.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{enquiry.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p><p className="mt-1 text-sm">{enquiry.message ?? (enquiry.packageId ? `Package enquiry · ${enquiry.packageId}` : enquiry.activityId ? `Activity enquiry · ${enquiry.activityId}` : "General enquiry")}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No enquiries linked.</p>}</aside>
    </section>
    <LeadDetailControls leadId={lead.id} actorId={staff.id} status={lead.status} closeReason={lead.closeReason} followUpAt={lead.followUpAt} assignedToId={lead.assignedToId} staff={lead.staff} notes={lead.notes.map((note) => ({ ...note, authorName: lead.authors[note.authorId] ?? "Staff" }))} events={lead.events} enquiries={lead.enquiries.map(({ id: enquiryId, reference, type, message, pagePath, createdAt }) => ({ id: enquiryId, reference, type, message, pagePath, createdAt }))} canWrite={canWrite} canAssign={canAssign} canEdit={canEdit} />
  </div>;
}
