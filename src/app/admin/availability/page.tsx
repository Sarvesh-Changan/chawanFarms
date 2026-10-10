import { notFound } from "next/navigation";

import { AvailabilityCalendar } from "@/components/admin/availability/AvailabilityCalendar";
import { getAdminAvailabilityCalendarAction } from "@/server/actions/admin-availability";
import { requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";

export const metadata = {
  title: "Availability & Capacity | Admin | Chawan Farms",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAvailabilityPage({ searchParams }: PageProps) {
  await requireStaff();
  await requirePermission("bookings.read");

  const resolvedParams = await searchParams;

  const accommodations = await db.accommodation.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  if (accommodations.length === 0) {
    notFound();
  }

  const selectedAccommodationId =
    typeof resolvedParams.accommodationId === "string"
      ? resolvedParams.accommodationId
      : accommodations[0]?.id ?? "";

  // Defaults: 30 days from today
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setUTCDate(today.getUTCDate() + 30);

  const startDate =
    typeof resolvedParams.startDate === "string"
      ? resolvedParams.startDate
      : today.toISOString().slice(0, 10);

  const endDate =
    typeof resolvedParams.endDate === "string"
      ? resolvedParams.endDate
      : nextMonth.toISOString().slice(0, 10);

  const res = await getAdminAvailabilityCalendarAction({
    accommodationId: selectedAccommodationId,
    startDate,
    endDate,
  });

  return (
    <AvailabilityCalendar
      accommodations={accommodations}
      selectedAccommodationId={selectedAccommodationId}
      days={res.data?.days || []}
      blackouts={res.data?.blackouts || []}
      startDate={startDate}
      endDate={endDate}
    />
  );
}
