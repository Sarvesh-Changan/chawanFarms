import type { Metadata } from "next";

import { ActivityCard } from "@/components/catalogue/CatalogueCards";
import { EmptyCatalogue } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame, CatalogueIntro } from "@/components/catalogue/CatalogueLayout";
import { getPublicActivities } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Activities · Chawan Farms", description: "Explore published activities at Chawan Farms." };
export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function ActivitiesPage() {
  const activities = await getPublicActivities();
  return <CatalogueFrame><CatalogueIntro eyebrow="Chawan Farms · Activities" title="Find your next outdoor moment." description="Published activities are subject to the conditions and availability shown in the catalogue."/><section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-24">{activities.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{activities.map((item) => <ActivityCard key={item.id} item={item}/>)}</div> : <EmptyCatalogue label="Activities"/>}</section></CatalogueFrame>;
}
