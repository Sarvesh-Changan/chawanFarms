import Link from "next/link";
import { notFound } from "next/navigation";

import { PageBuilder } from "@/components/admin/cms/PageBuilder";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { can } from "@/server/authz";
import { getCmsHeroMediaOptions } from "@/server/services/cms/options";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { getPageForBuilder, listPagesForBuilder } from "@/server/services/cms/pages";
import { getSeoImageOptions, getSeoMetadata } from "@/server/services/cms/seo";

export default async function CmsPagesAdmin({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const [{ id }, pages, mediaAllowed] = await Promise.all([searchParams, listPagesForBuilder(), can(staff, "media.read")]);
  if (!pages.length) return <section className="space-y-5"><PageHeader title="Page builder" description="Seed Home and About pages before editing their sections."/><p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No CMS pages are seeded yet. Run the idempotent database seed after applying migrations.</p></section>;
  const selectedId = id ?? pages.find((page) => page.slug === "home")?.id ?? pages[0]?.id;
  if (!selectedId) notFound();
  const [page, images, seoAllowed] = await Promise.all([getPageForBuilder(selectedId), mediaAllowed ? getCmsHeroMediaOptions() : [], can(staff, "seo.write")]);
  if (!page) notFound();
  const [seo, seoImages] = seoAllowed ? await Promise.all([getSeoMetadata("page", page.id), mediaAllowed ? getSeoImageOptions() : []]) : [null, []];
  return <section className="space-y-6">
    <PageHeader title="Page builder" description="Reorder, edit, hide or publish approved Home and About sections." />
    <nav aria-label="Choose page" className="flex flex-wrap gap-2">{pages.map((entry) => <Button key={entry.id} asChild variant={entry.id === page.id ? "default" : "outline"}><Link href={`/admin/cms/pages?id=${entry.id}`}>{entry.slug === "home" ? "Home" : entry.slug}</Link></Button>)}</nav>
    <PageBuilder page={page} images={images} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} seo={seo} seoImages={seoImages} canEditSeo={seoAllowed}/>
  </section>;
}
