import { notFound } from "next/navigation";

import { CmsContentEditor } from "@/components/admin/cms/CmsContentEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { CMS_CONTENT_TYPES, type CmsContentType } from "@/config/cms-content";
import { db } from "@/server/db";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function NewCmsContentPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!CMS_CONTENT_TYPES.includes(entity as CmsContentType)) notFound();
  const staff = await getCmsPageStaff("cms.write");
  if (!staff) return <NoAccess />;
  const type = entity as CmsContentType;
  const options = type === "menu-item" ? await db.menuCategory.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }).then((rows) => rows.map((row) => ({ id: row.id, label: typeof row.name === "object" && row.name !== null && "en" in row.name ? String(row.name.en) : row.id }))) : type === "post" ? await db.postCategory.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" }, select: { id: true, name: true } }).then((rows) => rows.map((row) => ({ id: row.id, label: typeof row.name === "object" && row.name !== null && "en" in row.name ? String(row.name.en) : row.id }))) : [];
  const packageOptions = type === "offer" ? await db.package.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, code: true } }).then((rows) => rows.map((row) => ({ id: row.id, label: `${row.code} — ${row.slug}` }))) : [];
  const media = type === "gallery-item" ? await db.media.findMany({ where: { origin: "ADMIN", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, publicId: true, kind: true, altText: true, format: true } }) : [];
  return <section className="space-y-6"><PageHeader title={`Create ${type.replaceAll("-", " ")}`} description="Save as draft; publishing requires the appropriate permission." /><CmsContentEditor entityType={type} options={options} packageOptions={packageOptions} media={media} cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} /></section>;
}
