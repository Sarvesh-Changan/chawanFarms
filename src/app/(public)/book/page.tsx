import type { Metadata } from "next";

import { BookingStepper } from "@/components/marketing/BookingStepper";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";

export const metadata: Metadata = {
  title: "Book or enquire · Chawan Farms",
  description: "A static booking enquiry stepper prototype for Chawan Farms.",
};

export default function BookPage() {
  return (
    <>
      <Header />
      <main className="bg-clay-100 px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28"><div className="mx-auto max-w-7xl"><p className="text-laterite-600 text-xs font-semibold tracking-[0.2em] uppercase">Book / Enquire</p><h1 className="font-heading text-forest-900 mt-3 max-w-3xl text-[clamp(2.5rem,7vw,5rem)] leading-[1]">Tell us how you would like to spend your time here.</h1><p className="text-mist-500 mt-5 max-w-2xl text-lg leading-8">This is a static stepper shell. It does not submit a booking or calculate a trusted price.</p><div className="mt-10"><BookingStepper /></div></div></main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
