import { notFound } from "next/navigation";

import { CmsContentEditor } from "@/components/admin/cms/CmsContentEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { CMS_CONTENT_TYPES, type CmsContentType } from "@/config/cms-content";
import { db } from "@/server/db";
import { getCmsContent } from "@/server/services/cms/content";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function EditCmsContentPage({ params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params;
  if (!CMS_CONTENT_TYPES.includes(entity as CmsContentType)) notFound();
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const type = entity as CmsContentType;
  const item = await getCmsContent(type, id);
  if (!item) notFound();
  const options = type === "menu-item" ? await db.menuCategory.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }).then((rows) => rows.map((row) => ({ id: row.id, label: typeof row.name === "object" && row.name !== null && "en" in row.name ? String(row.name.en) : row.id }))) : type === "post" ? await db.postCategory.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" }, select: { id: true, name: true } }).then((rows) => rows.map((row) => ({ id: row.id, label: typeof row.name === "object" && row.name !== null && "en" in row.name ? String(row.name.en) : row.id }))) : [];
  const packageOptions = type === "offer" ? await db.package.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, code: true } }).then((rows) => rows.map((row) => ({ id: row.id, label: `${row.code} — ${row.slug}` }))) : [];
  const media = type === "gallery-item" ? await db.media.findMany({ where: { origin: "ADMIN", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, publicId: true, kind: true, altText: true, format: true } }) : [];
  return <section className="space-y-6"><PageHeader title="Edit content" description={`Status: ${"status" in item ? item.status : "—"}`} /><CmsContentEditor entityType={type} id={id} item={item as unknown as Record<string, unknown>} options={options} packageOptions={packageOptions} media={media} cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} /></section>;
}
