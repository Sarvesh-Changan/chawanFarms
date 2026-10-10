import { ArrowRight, Calendar, CheckCircle2, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { env } from "@/config/env";
import { getPublicOffers, localizedString } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Special Offers & Seasonal Deals · Chawan Farms",
  description:
    "View active seasonal offers, stay discounts, and group deals for Chawan Farms agri-tourism centre in Kolad.",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default async function OffersPage() {
  const offers = await getPublicOffers();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SpecialAnnouncement",
    name: "Chawan Farms Special Offers",
    description: "Active promotions and seasonal offers for farm stays.",
    url: `${env.NEXT_PUBLIC_SITE_URL}/offers`,
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
              Limited Time &amp; Seasonal Specials
            </span>
            <h1 className="mt-3 font-heading text-4xl text-forest-900 sm:text-5xl md:text-6xl">
              Active Offers &amp; Savings
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Explore current seasonal promotions for family getaways, group camps,
              and weekday escapes. All offers are subject to stay dates and room
              availability.
            </p>
          </div>

          {/* Offers List */}
          {offers.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border/80 bg-card p-12 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest-900/10 text-forest-900">
                <Tag className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-heading text-2xl text-forest-900">
                No active promotional offers right now
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We periodically launch seasonal specials for monsoon stays, winter
                camps, and harvest celebrations. In the meantime, explore our
                all-inclusive standard packages.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/packages"
                  className="rounded-full bg-forest-900 px-6 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Explore Standard Packages
                </Link>
                <Link
                  href="/contact"
                  className="rounded-full border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Enquire for Group Rates
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => {
                const title = localizedString(offer.title);
                const description = localizedString(offer.description);
                const startsFormatted = formatDate(offer.startsAt);
                const endsFormatted = formatDate(offer.endsAt);

                let discountBadge = "";
                if (offer.discountType === "PERCENTAGE" && offer.discountValue) {
                  discountBadge = `${offer.discountValue}% OFF`;
                } else if (offer.discountType === "FIXED" && offer.discountValue) {
                  discountBadge = `₹${Math.round(offer.discountValue / 100)} OFF`;
                }

                return (
                  <article
                    key={offer.id}
                    className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition hover:shadow-md sm:p-8"
                  >
                    <div>
                      {/* Top Header with Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {discountBadge ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-turmeric-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-turmeric-700">
                            <Tag className="h-3 w-3" />
                            {discountBadge}
                          </span>
                        ) : (
                          <span className="rounded-full bg-forest-900/10 px-3 py-1 text-xs font-semibold text-forest-900">
                            Special Offer
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active Now
                        </span>
                      </div>

                      {/* Offer Title */}
                      <h2 className="mt-4 font-heading text-2xl text-forest-900">
                        {title}
                      </h2>

                      {/* Validity Period */}
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                        <Calendar className="h-4 w-4 text-forest-700" />
                        <span>
                          Valid: {startsFormatted} – {endsFormatted}
                        </span>
                      </div>

                      {/* Description */}
                      {description && (
                        <div className="mt-4 text-sm leading-relaxed text-muted-foreground">
                          <SafeHtml html={description} />
                        </div>
                      )}
                    </div>

                    {/* CTA Actions */}
                    <div className="mt-8 border-t border-border/70 pt-6">
                      <Link
                        href={`/book?offer=${offer.slug}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-900 py-3 text-sm font-semibold text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                      >
                        Book With This Offer <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
