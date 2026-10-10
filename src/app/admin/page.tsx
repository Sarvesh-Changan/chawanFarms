import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { getAdminDashboardData } from "@/server/services/admin-dashboard";
import { getLeadDashboardWidgets } from "@/server/services/leads-crm";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) return <NoAccess title="Sign in to continue" message="Use your invited staff account to open the admin dashboard." />;
  const staff = await getStaffPrincipal(session.user.id);
  if (!staff) return <NoAccess title="Staff access required" message="The admin dashboard is available to invited staff accounts." />;
  if (!(await can(staff, "dashboard.read"))) return <NoAccess title={staff.twoFactorEnabled ? "Dashboard access required" : "Set up two-factor authentication"} message={staff.twoFactorEnabled ? "Your current role cannot view the dashboard." : "Two-factor authentication is required for this staff role."} />;

  const canReadAudit = await can(staff, "audit.read");
  const canReadLeads = await can(staff, "leads.read");
  const data = await getAdminDashboardData(new Date(), canReadAudit, canReadLeads);
  const leadWidgets = canReadLeads ? await getLeadDashboardWidgets() : null;
  return <div className="space-y-7">
    <PageHeader eyebrow="Operations overview" title="Dashboard" description="A current view of incoming interest, bookings, rewards moderation and recent admin activity." />
    {canReadLeads ? <section aria-label="Lead activity" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Leads today" value={data.leads.today} detail="Created since midnight (IST)" />
      <StatCard label="Leads · 7 days" value={data.leads.sevenDays} detail="Including today" />
      <StatCard label="Leads · 30 days" value={data.leads.thirtyDays} detail="Including today" />
      <StatCard label="Videos awaiting review" value={data.pendingVideos} detail="Pending moderation" />
    </section> : <section><StatCard label="Videos awaiting review" value={data.pendingVideos} detail="Pending moderation" /></section>}
    {leadWidgets ? <section className="grid gap-5 xl:grid-cols-3" aria-label="Lead CRM analytics">
      <Card><CardHeader><CardTitle>New leads by day</CardTitle><CardDescription>Recent 30-day daily intake (India time).</CardDescription></CardHeader><CardContent><div className="grid gap-2">{leadWidgets.days.map(({ day, count }) => { const max = Math.max(1, ...leadWidgets.days.map((item) => item.count)); return <div key={day} className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-2 text-xs"><span>{day.slice(5)}</span><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-forest-700" style={{ width: `${Math.max(count ? 3 : 0, count / max * 100)}%` }} /></div><span className="text-right tabular-nums">{count}</span></div>; })}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Lead sources</CardTitle><CardDescription>All active leads by recorded source.</CardDescription></CardHeader><CardContent>{leadWidgets.sources.length ? <ul className="divide-y divide-border/70">{leadWidgets.sources.slice(0, 10).map(({ source, count }) => <li key={source} className="flex justify-between py-2 text-sm"><span>{source}</span><span className="font-semibold tabular-nums">{count}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No lead sources recorded.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Conversion funnel</CardTitle><CardDescription>Current lead pipeline counts.</CardDescription></CardHeader><CardContent><ul className="divide-y divide-border/70">{leadWidgets.funnel.map(({ status, count }) => <li key={status} className="flex items-center justify-between py-2"><StatusBadge status={status} /><span className="font-semibold tabular-nums">{count}</span></li>)}</ul></CardContent></Card>
    </section> : null}
    <section className="grid gap-5 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Enquiries by lead pipeline</CardTitle><CardDescription>Grouped by each enquiry’s linked lead status.</CardDescription></CardHeader><CardContent>{data.enquiriesByLeadStatus.length ? <ul className="divide-y divide-border/70">{data.enquiriesByLeadStatus.map(({ status, count }) => <li key={status} className="flex items-center justify-between py-3"><StatusBadge status={status} /><span className="font-semibold tabular-nums">{count}</span></li>)}</ul> : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No enquiries have been recorded yet.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Bookings by status</CardTitle><CardDescription>Current totals from the booking register.</CardDescription></CardHeader><CardContent>{data.bookingsByStatus.length ? <ul className="divide-y divide-border/70">{data.bookingsByStatus.map(({ status, count }) => <li key={status} className="flex items-center justify-between py-3"><StatusBadge status={status} /><span className="font-semibold tabular-nums">{count}</span></li>)}</ul> : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No bookings have been recorded yet.</p>}</CardContent></Card>
    </section>
    <Card><CardHeader><CardTitle>Recent admin activity</CardTitle><CardDescription>Latest recorded changes in the audit log.</CardDescription></CardHeader><CardContent>{!canReadAudit ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Audit activity is restricted to staff with audit access.</p> : data.recentAudit.length ? <ul className="divide-y divide-border/70">{data.recentAudit.map((event) => <li key={event.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="font-medium">{event.action}<span className="ml-2 text-muted-foreground">{event.entityType ?? ""} {event.entityId ?? ""}</span></p><time className="text-xs text-muted-foreground" dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</time></li>)}</ul> : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No admin activity has been recorded yet.</p>}</CardContent></Card>
  </div>;
}
