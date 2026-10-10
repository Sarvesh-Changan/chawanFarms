import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailBody, DetailHero, DetailPanel, localized } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame } from "@/components/catalogue/CatalogueLayout";
import { PackageRateToggle } from "@/components/catalogue/PackageRateToggle";
import { PackageEnquiryForm } from "@/components/forms/LeadCaptureForms";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSeoForSlug, metadataFromSeo } from "@/server/services/cms/seo";
import { getPublicPackageBySlug } from "@/server/services/public-content";

export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicPackageBySlug(slug);
  const title = item ? localized(item.name) + " · Chawan Farms" : "Package · Chawan Farms";
  const description = item ? localized(item.summary) || localized(item.description) || "Explore this published Chawan Farms package." : "Explore published Chawan Farms packages.";
  return metadataFromSeo(await getPublicSeoForSlug("package", slug), { title, description });
}

export default async function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, seo] = await Promise.all([getPublicPackageBySlug(slug), getPublicSeoForSlug("package", slug)]);
  if (!item) notFound();
  const rates = item.rates.map((rate) => ({ foodPreference: rate.foodPreference, audience: rate.audience, amountPaise: rate.amountPaise, percentOfAdult: rate.percentOfAdult }));
  return <CatalogueFrame><JsonLd data={seo?.jsonLd}/><DetailHero eyebrow={item.code ? "Package " + item.code : "Package"} title={localized(item.name)} summary={localized(item.summary) || localized(item.description)} media={item.heroMedia}/><DetailBody><div className="space-y-8"><DetailPanel title="Rates"><PackageRateToggle rates={rates}/>{item.minGuests ? <p>Minimum group: {item.minGuests}{item.maxGuests ? "–" + item.maxGuests : ""} persons.</p> : null}{localized(item.timingNote) ? <p>{localized(item.timingNote)}</p> : null}</DetailPanel>{localized(item.inclusions) ? <DetailPanel title="Inclusions"><p className="whitespace-pre-line">{localized(item.inclusions)}</p></DetailPanel> : null}{localized(item.conditions) ? <DetailPanel title="Conditions"><p className="whitespace-pre-line">{localized(item.conditions)}</p></DetailPanel> : null}{item.accommodations.length || item.activities.length ? <DetailPanel title="Related catalogue items">{item.accommodations.length ? <p>Accommodation: {item.accommodations.map(({ accommodation }) => localized(accommodation.name)).join(" · ")}</p> : null}{item.activities.length ? <p>Activities: {item.activities.map(({ activity }) => localized(activity.name)).join(" · ")}</p> : null}</DetailPanel> : null}</div><aside><PackageEnquiryForm packageId={item.id} description="Send an enquiry and the farm team will confirm availability, rates and details with you."/></aside></DetailBody></CatalogueFrame>;
}
