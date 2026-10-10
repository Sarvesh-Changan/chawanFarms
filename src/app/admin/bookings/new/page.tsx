import { ManualBookingForm } from "@/components/admin/bookings/ManualBookingForm";
import { can, requirePermission, requireStaff } from "@/server/authz";
import { db } from "@/server/db";

export const metadata = {
  title: "New Manual Booking | Admin | Chawan Farms",
};

export default async function NewManualBookingPage() {
  const staff = await requireStaff();
  await requirePermission("bookings.write");

  const [packages, accommodations, canConfirm] = await Promise.all([
    db.package.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { id: true, slug: true, name: true, minGuests: true, maxGuests: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.accommodation.findMany({
      where: { deletedAt: null },
      select: { id: true, slug: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    can(staff, "bookings.confirm"),
  ]);

  return (
    <ManualBookingForm
      packages={packages}
      accommodations={accommodations}
      canConfirm={canConfirm}
    />
  );
}
