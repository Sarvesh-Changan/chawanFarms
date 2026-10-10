import type { Metadata } from "next";

import { AccommodationCard } from "@/components/catalogue/CatalogueCards";
import { EmptyCatalogue } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame, CatalogueIntro } from "@/components/catalogue/CatalogueLayout";
import { getPublicAccommodations } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Accommodation · Chawan Farms", description: "Explore published accommodation at Chawan Farms." };
export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function AccommodationPage() {
  const accommodations = await getPublicAccommodations();
  return <CatalogueFrame><CatalogueIntro eyebrow="Chawan Farms · Accommodation" title="Stay close to the farm." description="Published accommodation details are shown from the catalogue. Availability and booking details are confirmed by the farm team."/><section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-24">{accommodations.length ? <div className="grid gap-5 md:grid-cols-2">{accommodations.map((item) => <AccommodationCard key={item.id} item={item}/>)}</div> : <EmptyCatalogue label="Accommodation"/>}</section></CatalogueFrame>;
}
