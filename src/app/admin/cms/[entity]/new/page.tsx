import { notFound } from "next/navigation";

import { CmsContentEditor } from "@/components/admin/cms/CmsContentEditor";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { CMS_CONTENT_TYPES, type CmsContentType } from "@/config/cms-content";
import { env } from "@/config/env";
import { getCmsEditorOptions } from "@/server/services/cms/content";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function NewCmsContentPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!CMS_CONTENT_TYPES.includes(entity as CmsContentType)) notFound();
  const staff = await getCmsPageStaff("cms.write");
  if (!staff) return <NoAccess />;
  const type = entity as CmsContentType;
  const editorOptions = await getCmsEditorOptions(type);
  return <section className="space-y-6"><PageHeader title={`Create ${type.replaceAll("-", " ")}`} description="Save as draft; publishing requires the appropriate permission." /><CmsContentEditor entityType={type} {...editorOptions} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} /></section>;
}
