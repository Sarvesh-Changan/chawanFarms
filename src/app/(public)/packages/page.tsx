import type { Metadata } from "next";

import { PackageCard } from "@/components/catalogue/CatalogueCards";
import { EmptyCatalogue } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame, CatalogueIntro } from "@/components/catalogue/CatalogueLayout";
import { getPublicPackages } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Packages · Chawan Farms", description: "Explore published Chawan Farms packages." };
export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function PackagesPage() {
  const packages = await getPublicPackages();
  return <CatalogueFrame><CatalogueIntro eyebrow="Chawan Farms · Packages" title="Choose your way into farm life." description="Published package details, rates and conditions are shown from the catalogue. The farm team confirms availability and the final enquiry details."/><section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-24">{packages.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{packages.map((item) => <PackageCard key={item.id} item={item}/>)}</div> : <EmptyCatalogue label="Packages"/>}</section></CatalogueFrame>;
}
