import { z } from "zod";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import { env } from "@/config/env";
import { getSession } from "@/server/auth";
import { can, getStaffPrincipal } from "@/server/authz";
import { listMedia } from "@/server/services/media";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["IMAGE", "VIDEO"]).optional(),
  category: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(40).optional(),
}).strict();

export default async function AdminMediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (!session) return <NoAccess title="Staff access required" />;
  const staff = await getStaffPrincipal(session.user.id);
  if (!staff || !(await can(staff, "media.read"))) return <NoAccess />;

  const rawParams = await searchParams;
  const parsed = searchSchema.safeParse(Object.fromEntries(Object.entries(rawParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  if (!parsed.success) return <NoAccess title="Invalid media filters" message="Clear the filters and try again." />;
  const [data, canWrite, canDelete] = await Promise.all([
    listMedia({ ...parsed.data, pageSize: 24, includeDeleted: false }),
    can(staff, "media.write"),
    can(staff, "media.delete"),
  ]);
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return <section className="space-y-6"><PageHeader title="Media library" description="Cloudinary is not configured yet." /><p className="rounded-xl border p-4 text-sm text-muted-foreground">Set the Cloudinary server credentials and cloud name to enable media uploads.</p></section>;

  return <section className="space-y-6"><PageHeader title="Media library" description="Search and manage approved images and video assets." /><MediaLibrary items={data.rows} total={data.total} categories={data.categories} tags={data.tags} cloudName={cloudName} canWrite={canWrite} canDelete={canDelete} page={data.page} pageCount={data.pageCount} filters={{ q: parsed.data.q, kind: parsed.data.kind ?? "", category: parsed.data.category ?? "", tag: parsed.data.tag ?? "" }} /></section>;
}
