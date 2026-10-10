import { notFound } from "next/navigation";

import { BookingsList } from "@/components/admin/bookings/BookingsList";
import { getAdminBookingsAction } from "@/server/actions/admin-bookings";

export const metadata = {
  title: "Bookings | Admin | Chawan Farms",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  const result = await getAdminBookingsAction(resolvedParams);
  if (!result.ok || !result.bookings) {
    notFound();
  }

  return (
    <BookingsList
      bookings={result.bookings}
      totalCount={result.totalCount ?? 0}
      page={result.page ?? 1}
      pageSize={result.pageSize ?? 20}
      totalPages={result.totalPages ?? 1}
    />
  );
}
