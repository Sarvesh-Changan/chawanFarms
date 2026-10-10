import { notFound } from "next/navigation";

import { BookingDetailView } from "@/components/admin/bookings/BookingDetailView";
import { getAdminBookingDetailAction } from "@/server/actions/admin-bookings";

export const metadata = {
  title: "Booking Detail | Admin | Chawan Farms",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminBookingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const result = await getAdminBookingDetailAction(id);
  if (!result.ok || !result.booking) {
    notFound();
  }

  return (
    <BookingDetailView
      booking={result.booking}
      auditLogs={result.auditLogs || []}
    />
  );
}
