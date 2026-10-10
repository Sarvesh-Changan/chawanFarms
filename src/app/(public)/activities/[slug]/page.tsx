import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailBody, DetailHero, DetailPanel, localized } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame } from "@/components/catalogue/CatalogueLayout";
import { FavouriteButton } from "@/components/catalogue/FavouriteButton";
import { ActivityEnquiryForm } from "@/components/forms/LeadCaptureForms";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSeoForSlug, metadataFromSeo } from "@/server/services/cms/seo";
import { getPublicActivityBySlug } from "@/server/services/public-content";

export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicActivityBySlug(slug);
  return metadataFromSeo(await getPublicSeoForSlug("activity", slug), { title: item ? localized(item.name) + " · Chawan Farms" : "Activity · Chawan Farms", description: item ? localized(item.summary) || "Explore this published Chawan Farms activity." : "Explore published Chawan Farms activities." });
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, seo] = await Promise.all([getPublicActivityBySlug(slug), getPublicSeoForSlug("activity", slug)]);
  if (!item) notFound();
  return <CatalogueFrame><JsonLd data={seo?.jsonLd}/><DetailHero eyebrow="Activity" title={localized(item.name)} summary={localized(item.summary)} media={item.heroMedia}/><DetailBody><div className="space-y-8"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{item.isExtraCost ? <span className="bg-turmeric-500 text-ink-900 rounded-full px-3 py-1 text-xs font-semibold">Extra cost</span> : null}{localized(item.conditionsNote) ? <span className="bg-clay-100 text-forest-900 rounded-full px-3 py-1 text-xs font-semibold">Subject to conditions & availability</span> : null}</div><FavouriteButton entityType="activity" entityId={item.id} label={localized(item.name)}/></div>{localized(item.description) ? <DetailPanel title="About this activity"><p className="whitespace-pre-line">{localized(item.description)}</p></DetailPanel> : null}{localized(item.priceNote) ? <DetailPanel title="Price note"><p>{localized(item.priceNote)}</p></DetailPanel> : null}{item.needsPriorNotice ? <DetailPanel title="Prior notice"><p>Prior notice is required for this activity.</p></DetailPanel> : null}</div><aside><ActivityEnquiryForm activityId={item.id} description="Send an enquiry and the farm team will confirm conditions, availability and details with you."/></aside></DetailBody></CatalogueFrame>;
}
