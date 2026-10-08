import { notFound } from "next/navigation";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { verifyPreviewToken } from "@/server/cms/preview";
import { getCmsContentForPreview } from "@/server/services/cms/content";

export const metadata = { robots: { index: false, follow: false } };

export default async function CmsPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const grant = verifyPreviewToken(token);
  if (!grant) notFound();
  const item = await getCmsContentForPreview(grant.entityType, grant.id);
  if (!item) notFound();
  const value = item as Record<string, unknown>;
  const localized = (candidate: unknown): string => candidate && typeof candidate === "object" && "en" in candidate ? String((candidate as { en?: unknown }).en ?? "") : "";
  const title = localized(value.title ?? value.name ?? value.question ?? value.quote) || String(value.authorName ?? "Content preview");
  const body = value.body ?? value.description ?? value.answer;
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12"><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Unpublished preview</p><h1 className="font-heading text-4xl">{title}</h1>{body ? <SafeHtml html={localized(body)} /> : null}</main>;
}
