import type { Metadata } from "next";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { HomeSections } from "@/components/marketing/HomeSections";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSeoWithImage, metadataFromSeo } from "@/server/services/cms/seo";
import { getPublicHomeData } from "@/server/services/public-content";

const fallbackMetadata: Metadata = {
  title: "Chawan Farms",
  description: "Chawan Farms agri-tourism centre in Baitwadi, Kolad.",
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicHomeData();
  return data.page ? metadataFromSeo(await getPublicSeoWithImage("page", data.page.id), fallbackMetadata) : fallbackMetadata;
}

export default async function HomePage() {
  const data = await getPublicHomeData();
  const seo = data.page ? await getPublicSeoWithImage("page", data.page.id) : null;
  return <>
    <JsonLd data={seo?.jsonLd}/>
    <Header />
    <HomeSections data={data}/>
    <StickyCtaBar />
    <Footer />
  </>;
}
