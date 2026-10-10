import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { DetailBody, DetailHero, DetailPanel, localized } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame } from "@/components/catalogue/CatalogueLayout";
import { FavouriteButton } from "@/components/catalogue/FavouriteButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSeoForSlug, metadataFromSeo } from "@/server/services/cms/seo";
import { getPublicExperienceBySlug } from "@/server/services/public-content";

export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicExperienceBySlug(slug);
  return metadataFromSeo(await getPublicSeoForSlug("experience", slug), { title: item ? localized(item.title) + " · Chawan Farms" : "Experience · Chawan Farms", description: item ? localized(item.summary) || "Explore this published Chawan Farms experience." : "Explore published Chawan Farms experiences." });
}

export default async function ExperienceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, seo] = await Promise.all([getPublicExperienceBySlug(slug), getPublicSeoForSlug("experience", slug)]);
  if (!item) notFound();
  return <CatalogueFrame><JsonLd data={seo?.jsonLd}/><DetailHero eyebrow="Experience" title={localized(item.title)} summary={localized(item.summary)} media={item.heroMedia}/><DetailBody><div className="space-y-8"><div className="flex justify-end"><FavouriteButton entityType="experience" entityId={item.id} label={localized(item.title)}/></div>{localized(item.body) ? <DetailPanel title="About this experience"><SafeHtml html={localized(item.body)} className="prose max-w-none"/></DetailPanel> : null}</div><div /></DetailBody></CatalogueFrame>;
}
