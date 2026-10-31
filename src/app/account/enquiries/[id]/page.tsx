import { notFound } from "next/navigation";

import { AccountFrame, StatusChip } from "@/components/account/AccountFrame";
import { requireCustomer } from "@/server/auth";
import { getCustomerEnquiry } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function date(value: Date | null): string { return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(value) : "—"; }

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) { const session = await requireCustomer(); const { id } = await params; const enquiry = await getCustomerEnquiry(session.user.id, id); if (!enquiry) notFound(); return <AccountFrame title={enquiry.reference} description="Customer-visible enquiry details."><section className="max-w-3xl rounded-2xl border border-border/70 bg-card p-5 sm:p-7"><div className="flex flex-wrap items-center gap-3"><StatusChip value={enquiry.lead.status} /><StatusChip value={enquiry.type} /></div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Received</dt><dd className="mt-1 text-sm font-medium">{date(enquiry.createdAt)}</dd></div><div><dt className="text-xs text-muted-foreground">Preferred dates</dt><dd className="mt-1 text-sm font-medium">{date(enquiry.preferredStart)} – {date(enquiry.preferredEnd)}</dd></div><div><dt className="text-xs text-muted-foreground">Group size</dt><dd className="mt-1 text-sm font-medium">{enquiry.groupSize ?? "Not specified"}</dd></div></dl><div className="mt-8"><h2 className="font-heading text-xl text-forest-900">Your message</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{enquiry.message || "No message was included."}</p></div></section></AccountFrame>; }
