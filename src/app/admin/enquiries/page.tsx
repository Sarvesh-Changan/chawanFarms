import { EnquiriesList } from "@/components/admin/enquiries/EnquiriesList";
import { NoAccess } from "@/components/admin/NoAccess";
import { adminEnquiryFiltersSchema } from "@/lib/schemas/admin-enquiries";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal, requirePermission } from "@/server/authz";
import { listAdminEnquiries } from "@/server/services/admin-enquiries";

export const metadata = {
  title: "Enquiries | Admin | Chawan Farms",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminEnquiriesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff) return <NoAccess title="Staff access required" />;

  try {
    await requirePermission("enquiries.read");
  } catch {
    return (
      <NoAccess
        title="Enquiries access required"
        message="Your staff role does not have permission to view enquiries."
      />
    );
  }

  const raw = await searchParams;
  const parsed = adminEnquiryFiltersSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : adminEnquiryFiltersSchema.parse({});

  const [result, canWrite] = await Promise.all([
    listAdminEnquiries(filters),
    can(staff, "enquiries.write"),
  ]);

  return <EnquiriesList data={result} canWrite={canWrite} />;
}
