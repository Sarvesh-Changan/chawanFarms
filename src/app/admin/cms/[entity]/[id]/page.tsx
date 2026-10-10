import { notFound } from "next/navigation";

import { CmsContentEditor } from "@/components/admin/cms/CmsContentEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { CMS_CONTENT_TYPES, type CmsContentType } from "@/config/cms-content";
import { env } from "@/config/env";
import { getCmsContent, getCmsEditorOptions } from "@/server/services/cms/content";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function EditCmsContentPage({ params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params;
  if (!CMS_CONTENT_TYPES.includes(entity as CmsContentType)) notFound();
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const type = entity as CmsContentType;
  const item = await getCmsContent(type, id);
  if (!item) notFound();
  const editorOptions = await getCmsEditorOptions(type);
  return <section className="space-y-6"><PageHeader title="Edit content" description={`Status: ${"status" in item ? item.status : "—"}`} /><CmsContentEditor entityType={type} id={id} item={item as unknown as Record<string, unknown>} {...editorOptions} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} /></section>;
}
