import type { Metadata } from "next";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { PackageCard } from "@/components/marketing/PackageCard";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { prototypePackages } from "@/lib/prototype-data";

export const metadata: Metadata = {
  title: "Packages · Chawan Farms",
  description: "Explore the static package prototype for Chawan Farms.",
};

export default function PackagesPage() {
  return (
    <>
      <Header />
      <main>
        <section className="bg-forest-900 text-cream-50 px-4 py-20 sm:px-8 lg:px-12 lg:py-28"><div className="mx-auto max-w-7xl"><p className="text-paddy-300 text-xs font-semibold tracking-[0.2em] uppercase">Chawan Farms · Packages</p><h1 className="font-heading mt-4 max-w-3xl text-[clamp(3rem,8vw,6rem)] leading-[0.95]">Make a day of the farm.</h1><p className="text-cream-50/75 mt-6 max-w-xl text-lg leading-8">Choose a starting point. The team will confirm availability, final price and policy details with you.</p></div></section>
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28"><SectionHeading eyebrow="Compare" title="Packages from the client source." description="Rates are shown in INR per person per day where Appendix A provides them. No extra charges have been invented for the prototype." /><div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{prototypePackages.map((packageData) => <PackageCard key={packageData.id} package={packageData} />)}</div><div className="bg-clay-100 text-forest-900 mt-8 rounded-xl p-5 text-sm leading-6"><strong>Before you enquire:</strong> Appendix A includes unresolved policy and scope notes. Rates, availability, minimum groups, menu details and cancellation terms are confirmed by the farm team before a booking is accepted.</div></section>
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
