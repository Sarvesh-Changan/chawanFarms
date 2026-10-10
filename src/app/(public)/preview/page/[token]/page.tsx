import { notFound } from "next/navigation";

import { PageSectionsRenderer } from "@/components/cms/PageSectionsRenderer";
import { verifyPagePreviewToken } from "@/server/cms/page-preview";
import { getPageForPreview } from "@/server/services/cms/pages";

export const metadata = { robots: { index: false, follow: false } };

export default async function PagePreview({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const grant = verifyPagePreviewToken(token);
  if (!grant) notFound();
  const page = await getPageForPreview(grant.pageId);
  if (!page) notFound();
  return <PageSectionsRenderer page={page} preview/>;
}
