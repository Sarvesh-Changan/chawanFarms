import { notFound } from "next/navigation";
import { z } from "zod";

import { PackageEditor } from "@/components/admin/cms/PackageEditor";
import { SeoMetadataPanel } from "@/components/admin/cms/SeoMetadataPanel";
import { NoAccess } from "@/components/admin/NoAccess";
import { env } from "@/config/env";
import { can } from "@/server/authz";
import { getCmsHeroMediaOptions } from "@/server/services/cms/options";
import { getPackageForEditor, listPackageRelationOptions } from "@/server/services/cms/packages";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { getSeoImageOptions, getSeoMetadata } from "@/server/services/cms/seo";

function localized(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { en: "", mr: "", hi: "" };
  const record = value as Record<string, unknown>;
  return { en: typeof record.en === "string" ? record.en : "", mr: typeof record.mr === "string" ? record.mr : "", hi: typeof record.hi === "string" ? record.hi : "" };
}

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const { id: rawId } = await params;
  const parsedId = z.string().uuid().safeParse(rawId);
  if (!parsedId.success) notFound();
  const id = parsedId.data;
  const [record, options, permissions] = await Promise.all([
    getPackageForEditor(id),
    listPackageRelationOptions(),
    Promise.all([can(staff, "cms.write"), can(staff, "cms.publish"), can(staff, "cms.delete"), can(staff, "media.read"), can(staff, "seo.write")]),
  ]);
  if (!record || record.deletedAt) notFound();
  const mediaOptions = permissions[3] ? await getCmsHeroMediaOptions() : [];
  const [seo, seoImages] = permissions[4] ? await Promise.all([getSeoMetadata("package", record.id), permissions[3] ? getSeoImageOptions() : []]) : [null, []];
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME ?? "";
  const initial = {
    id: record.id,
    slug: record.slug,
    code: record.code ?? "",
    name: localized(record.name),
    summary: localized(record.summary),
    description: localized(record.description),
    inclusions: localized(record.inclusions),
    conditions: localized(record.conditions),
    timingNote: localized(record.timingNote),
    minGuests: record.minGuests === null ? "" : String(record.minGuests),
    maxGuests: record.maxGuests === null ? "" : String(record.maxGuests),
    isDayVisit: record.isDayVisit,
    isGroupOnly: record.isGroupOnly,
    heroMediaId: record.heroMediaId ?? "",
    accommodationIds: record.accommodations.map(({ accommodationId }) => accommodationId),
    activityIds: record.activities.map(({ activityId }) => activityId),
    status: record.status,
    publishAt: record.publishAt,
  };
  return <div className="space-y-6"><PackageEditor initial={initial} rates={record.rates} accommodationOptions={options.accommodations} activityOptions={options.activities} mediaOptions={mediaOptions} cloudName={cloudName} canWrite={permissions[0]} canPublish={permissions[1]} canDelete={permissions[2]} />{permissions[4] ? <SeoMetadataPanel entityType="package" entityId={record.id} initial={seo} images={seoImages} cloudName={cloudName}/> : null}</div>;
}
