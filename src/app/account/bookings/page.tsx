import Link from "next/link";

import { AccountFrame, EmptyState, StatusChip } from "@/components/account/AccountFrame";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { requireCustomer } from "@/server/auth";
import { accountJsonLabel, listCustomerBookings, listCustomerEnquiries } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function date(value: Date | null): string { return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(value) : "—"; }

export default async function AccountBookingsPage() {
  const session = await requireCustomer();
  const [bookings, enquiries] = await Promise.all([listCustomerBookings(session.user.id), listCustomerEnquiries(session.user.id)]);
  return <AccountFrame title="Bookings & enquiries" description="Your customer-visible requests, statuses and server-computed price snapshots."><div className="grid gap-8"><section aria-labelledby="booking-list-heading"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="booking-list-heading" className="font-heading text-2xl text-forest-900">Bookings</h2><Button asChild size="sm"><Link href="/book">New booking</Link></Button></div>{bookings.length === 0 ? <EmptyState title="No bookings yet" body="Your confirmed and pending booking requests will appear here." action={<Button asChild><Link href="/book">Start a booking</Link></Button>} /> : <div className="grid gap-3">{bookings.map((booking) => <Link key={booking.id} href={`/account/bookings/${booking.id}`} className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5 transition hover:border-forest-700 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-forest-900">{booking.reference}</h3><StatusChip value={booking.status} /></div><p className="mt-2 text-sm text-muted-foreground">{accountJsonLabel(booking.package?.name) ?? booking.package?.slug ?? "Booking request"} · {date(booking.checkIn)} to {date(booking.checkOut)}</p></div><p className="text-sm font-semibold text-forest-900">{formatINR(booking.totalPaise)}</p></Link>)}</div>}</section><section aria-labelledby="enquiry-list-heading"><h2 id="enquiry-list-heading" className="mb-4 font-heading text-2xl text-forest-900">Enquiries</h2>{enquiries.length === 0 ? <EmptyState title="No enquiries yet" body="Questions and quick enquiries linked to your verified account email will appear here." /> : <div className="grid gap-3">{enquiries.map((enquiry) => <Link key={enquiry.id} href={`/account/enquiries/${enquiry.id}`} className="rounded-2xl border border-border/70 bg-card p-5 transition hover:border-forest-700"><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-forest-900">{enquiry.reference}</h3><StatusChip value={enquiry.lead.status} /></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{enquiry.message || "Enquiry submitted without a message."}</p><p className="mt-3 text-xs text-muted-foreground">Received {date(enquiry.createdAt)}</p></Link>)}</div>}</section></div></AccountFrame>;
}
