import { notFound } from "next/navigation";
import { z } from "zod";

import { AccommodationEditor } from "@/components/admin/cms/AccommodationEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { env } from "@/config/env";
import { can } from "@/server/authz";
import { getAccommodationForEditor } from "@/server/services/cms/accommodations";
import { getCmsHeroMediaOptions } from "@/server/services/cms/options";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

function localized(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { en: "", mr: "", hi: "" };
  const record = value as Record<string, unknown>;
  return { en: typeof record.en === "string" ? record.en : "", mr: typeof record.mr === "string" ? record.mr : "", hi: typeof record.hi === "string" ? record.hi : "" };
}

export default async function EditAccommodationPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const { id: rawId } = await params;
  const id = z.string().uuid().safeParse(rawId);
  if (!id.success) notFound();
  const [record, permissions] = await Promise.all([
    getAccommodationForEditor(id.data),
    Promise.all([can(staff, "cms.write"), can(staff, "cms.publish"), can(staff, "cms.delete"), can(staff, "media.read")]),
  ]);
  if (!record || record.deletedAt) notFound();
  const mediaOptions = permissions[3] ? await getCmsHeroMediaOptions() : [];
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME;
  const initial = {
    id: record.id,
    slug: record.slug,
    type: record.type,
    name: localized(record.name),
    summary: localized(record.summary),
    description: localized(record.description),
    unitsTotal: record.unitsTotal === null ? "" : String(record.unitsTotal),
    maxGuests: record.maxGuests === null ? "" : String(record.maxGuests),
    amenities: localized(record.amenities),
    heroMediaId: record.heroMediaId ?? "",
    imageMediaIds: record.imageMediaIds,
    status: record.status,
    publishAt: record.publishAt,
  };
  return <AccommodationEditor initial={initial} mediaOptions={mediaOptions} cloudName={cloudName} canWrite={permissions[0]} canPublish={permissions[1]} canDelete={permissions[2]} />;
}
