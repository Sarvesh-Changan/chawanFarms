import { ArrowRight, Compass, Sprout, SunMedium, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageSectionsRenderer } from "@/components/cms/PageSectionsRenderer";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublishedPage } from "@/server/services/cms/pages";
import { getPublicSeoWithImage, metadataFromSeo } from "@/server/services/cms/seo";

export const dynamic = "force-dynamic";

const fallbackMetadata: Metadata = {
  title: "About Us · Chawan Farms Agri-Tourism Centre",
  description:
    "Discover Chawan Farms in Baitwadi, Kolad — an authentic agri-tourism centre dedicated to rural life awareness, agricultural science, and nature experiences.",
};

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("about");
  return page
    ? metadataFromSeo(await getPublicSeoWithImage("page", page.id), fallbackMetadata)
    : fallbackMetadata;
}

export default async function AboutPage() {
  const page = await getPublishedPage("about");
  const seo = page ? await getPublicSeoWithImage("page", page.id) : null;

  return (
    <>
      <JsonLd data={seo?.jsonLd} />
      <Header />
      {page ? (
        <PageSectionsRenderer page={page} />
      ) : (
        <main className="min-h-screen bg-cream-50/60 pb-20 pt-8 sm:pt-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {/* Hero Section */}
            <header className="mb-14 text-center sm:mb-20">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-laterite-600">
                कृषी पर्यटन केंद्र · Agri-Tourism Centre
              </span>
              <h1 className="mt-3 font-heading text-4xl text-forest-900 sm:text-5xl md:text-6xl">
                Where Time Slows Down
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                &ldquo;Come live, experience &amp; rediscover yourself &amp; nature
                at its best.&rdquo;
              </p>
            </header>

            {/* Core Philosophy Section */}
            <section className="mb-16 rounded-3xl border border-forest-900/10 bg-card p-8 shadow-sm sm:p-12">
              <h2 className="font-heading text-2xl text-forest-900 sm:text-3xl">
                Our Purpose &amp; Rural Vision
              </h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <p>
                  Located at Baitwadi, Kolad (Tal. Roha, Dist. Raigad, Maharashtra),
                  Chawan Farms was founded to connect people back to the land.
                </p>
                <p>
                  As an authentic agri-tourism centre, our goal is to foster
                  genuine awareness of rural life and knowledge about agricultural
                  science among urban school children and citizens alike. We believe
                  in restoring rural culture and offering an inexpensive, wholesome
                  gateway to nature.
                </p>
              </div>
            </section>

            {/* Farm Pillars Grid */}
            <section className="mb-16">
              <h2 className="mb-8 text-center font-heading text-3xl text-forest-900">
                What Makes Chawan Farms Authentic
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                    <Sprout className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-forest-900">
                    Working Agricultural Farm
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Horticultural farming, organic crops, dairy cows, and poultry.
                    Experience real farming practices, soil, and seasonal produce
                    first-hand.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                    <SunMedium className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-forest-900">
                    Sahyadri Nature &amp; River
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Swimming in the Kundalika river and a small farm swimming tank,
                    mountain treks, nature trails, birdwatching, and undisturbed
                    stargazing.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-forest-900">
                    School &amp; Camp Outings
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Dedicated agricultural study visits for schools and expansive
                    lawn grounds with amenities for independent camp organisers and
                    nature groups.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                    <Compass className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-forest-900">
                    Fresh Maharashtrian Meals
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Traditional meals cooked fresh in our open dining area: bhakri,
                    dal, seasonal vegetables, pitla, misal, kanda-poha, and local
                    specialties.
                  </p>
                </div>
              </div>
            </section>

            {/* Location & Contact Notice */}
            <section className="rounded-3xl border border-forest-900/15 bg-gradient-to-br from-forest-900/5 to-clay-100/60 p-8 text-center sm:p-12">
              <span className="text-xs font-semibold uppercase tracking-wider text-laterite-600">
                Plan Your Visit
              </span>
              <h2 className="mt-2 font-heading text-3xl text-forest-900">
                Experience Rural Maharashtra First-Hand
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
                We welcome family weekend getaways, day picnics, school educational
                tours, and camper groups.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  href="/packages"
                  className="rounded-full bg-forest-900 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Explore Stay Packages
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Contact Farm Team <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </div>
        </main>
      )}
      <StickyCtaBar />
      <Footer />
    </>
  );
}
