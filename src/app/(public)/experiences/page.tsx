import type { Metadata } from "next";

import { ExperienceCard } from "@/components/catalogue/CatalogueCards";
import { EmptyCatalogue } from "@/components/catalogue/CatalogueDetails";
import { CatalogueFrame, CatalogueIntro } from "@/components/catalogue/CatalogueLayout";
import { getPublicExperiences } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Experiences · Chawan Farms", description: "Explore published farm and nature experiences at Chawan Farms." };
export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function ExperiencesPage() {
  const experiences = await getPublicExperiences();
  return <CatalogueFrame><CatalogueIntro eyebrow="Chawan Farms · Experiences" title="Spend time with the living farm." description="Explore published experiences from the Chawan Farms catalogue."/><section className="bg-clay-100"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-24">{experiences.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{experiences.map((item) => <ExperienceCard key={item.id} item={item}/>)}</div> : <EmptyCatalogue label="Experiences"/>}</div></section></CatalogueFrame>;
}
