import type { Metadata } from "next";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { HomeSections } from "@/components/marketing/HomeSections";
import { LegacyHashRedirect } from "@/components/marketing/LegacyHashRedirect";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { getPublicHomeData } from "@/server/services/public-content";

const fallbackMetadata: Metadata = {
  title: "Chawan Farms",
  description: "Chawan Farms agri-tourism centre in Baitwadi, Kolad.",
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return fallbackMetadata;
}

export default async function HomePage() {
  const data = await getPublicHomeData();
  return <>
    <LegacyHashRedirect />
    <Header />
    <HomeSections data={data}/>
    <StickyCtaBar />
    <Footer />
  </>;
}
