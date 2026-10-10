import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailBody, DetailHero, DetailPanel, localized, MediaGallery } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame } from "@/components/catalogue/CatalogueLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSeoForSlug, metadataFromSeo } from "@/server/services/cms/seo";
import { getPublicAccommodationBySlug } from "@/server/services/public-content";

export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicAccommodationBySlug(slug);
  const title = item ? localized(item.name) + " · Chawan Farms" : "Accommodation · Chawan Farms";
  const description = item ? localized(item.summary) || localized(item.description) || "Explore this published Chawan Farms accommodation." : "Explore published Chawan Farms accommodation.";
  return metadataFromSeo(await getPublicSeoForSlug("accommodation", slug), { title, description });
}

export default async function AccommodationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, seo] = await Promise.all([getPublicAccommodationBySlug(slug), getPublicSeoForSlug("accommodation", slug)]);
  if (!item) notFound();
  return <CatalogueFrame><JsonLd data={seo?.jsonLd}/><DetailHero eyebrow="Accommodation" title={localized(item.name)} summary={localized(item.summary) || localized(item.description)} media={item.heroMedia}/><DetailBody><div className="space-y-8">{localized(item.description) ? <DetailPanel title="About this stay"><p className="whitespace-pre-line">{localized(item.description)}</p></DetailPanel> : null}{localized(item.amenities) ? <DetailPanel title="Published details"><p className="whitespace-pre-line">{localized(item.amenities)}</p></DetailPanel> : null}{item.unitsTotal || item.maxGuests ? <DetailPanel title="Capacity details">{item.unitsTotal ? <p>Units: {item.unitsTotal}</p> : null}{item.maxGuests ? <p>Maximum guests: {item.maxGuests}</p> : null}</DetailPanel> : null}</div><MediaGallery media={item.gallery} label={localized(item.name)}/></DetailBody></CatalogueFrame>;
}
