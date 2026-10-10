import { MessageSquare, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/cms/FaqAccordion";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicFaqs, localizedString } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQs) · Chawan Farms",
  description:
    "Find answers about stay packages, food options, check-in policies, farm rules, and activities at Chawan Farms in Baitwadi, Kolad.",
};

export default async function FaqsPage() {
  const faqs = await getPublicFaqs();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: localizedString(faq.question),
      acceptedAnswer: {
        "@type": "Answer",
        text: localizedString(faq.answer),
      },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Header />
      <main className="min-h-screen bg-cream-50/60 pb-20 pt-8 sm:pt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12 text-center sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-laterite-600">
              Answers & Information
            </span>
            <h1 className="mt-3 font-heading text-4xl text-forest-900 sm:text-5xl md:text-6xl">
              Frequently Asked Questions
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Find essential details regarding farm stay packages, Maharashtrian
              meals, children pricing, camping facilities, and visitor policies.
            </p>
          </div>

          {/* FAQ Accordion Component */}
          <FaqAccordion items={faqs} />

          {/* Need More Assistance Section */}
          <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-forest-900/15 bg-card p-8 text-center shadow-sm sm:p-10">
            <h2 className="font-heading text-2xl text-forest-900">
              Have another question?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Our farm team is ready to answer questions about group bookings,
              school outings, custom menus, and directions.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
              >
                <MessageSquare className="h-4 w-4" /> Send an Enquiry
              </Link>
              <a
                href="tel:9821502956"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
              >
                <Phone className="h-4 w-4" /> Call 9821502956
              </a>
            </div>
          </div>
        </div>
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
