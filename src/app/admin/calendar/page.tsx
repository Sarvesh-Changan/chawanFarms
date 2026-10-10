import { ArrivalsDeparturesCalendar } from "@/components/admin/calendar/ArrivalsDeparturesCalendar";
import { getAdminCalendarEventsAction } from "@/server/actions/admin-availability";
import { requirePermission, requireStaff } from "@/server/authz";

export const metadata = {
  title: "Arrivals & Calendar | Admin | Chawan Farms",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  await requireStaff();
  await requirePermission("bookings.read");

  const resolvedParams = await searchParams;

  const today = new Date();
  const nextFortnight = new Date();
  nextFortnight.setUTCDate(today.getUTCDate() + 14);

  const startDate =
    typeof resolvedParams.startDate === "string"
      ? resolvedParams.startDate
      : today.toISOString().slice(0, 10);

  const endDate =
    typeof resolvedParams.endDate === "string"
      ? resolvedParams.endDate
      : nextFortnight.toISOString().slice(0, 10);

  const result = await getAdminCalendarEventsAction({
    startDate,
    endDate,
  });

  return (
    <ArrivalsDeparturesCalendar
      events={result.events || []}
      startDate={startDate}
      endDate={endDate}
    />
  );
}
