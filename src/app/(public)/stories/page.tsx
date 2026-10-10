import { ArrowRight, Calendar, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { CldImage } from "@/components/media/CldImage";
import { JsonLd } from "@/components/seo/JsonLd";
import { env } from "@/config/env";
import { getPublicStories, localizedString } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Farm Stories & Chronicles · Chawan Farms",
  description:
    "Read stories about sustainable farming, rural traditions, wildlife observation, and life in the Sahyadris at Chawan Farms, Kolad.",
};

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default async function StoriesPage() {
  const stories = await getPublicStories();
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Chawan Farms Stories & Chronicles",
    description: "Chronicles and stories from Chawan Farms agri-tourism centre.",
    blogPost: stories.map((s) => ({
      "@type": "BlogPosting",
      headline: localizedString(s.title),
      datePublished: s.publishAt ? new Date(s.publishAt).toISOString() : undefined,
      url: `${env.NEXT_PUBLIC_SITE_URL}/stories/${s.slug}`,
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
              Farm Chronicles &amp; Insights
            </span>
            <h1 className="mt-3 font-heading text-4xl text-forest-900 sm:text-5xl md:text-6xl">
              Tales from Baitwadi &amp; the Sahyadris
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Explore stories of agricultural rhythms, native plants and birds,
              rural culinary traditions, and reflections from the farm.
            </p>
          </div>

          {/* Stories Grid */}
          {stories.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <h2 className="font-heading text-2xl text-forest-900">
                Stories are being penned
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Our farm chronicles will be published here soon. Check back shortly
                or explore our experiences and accommodation in the meantime.
              </p>
              <div className="mt-6">
                <Link
                  href="/experiences"
                  className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-6 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Explore Experiences <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => {
                const title = localizedString(story.title);
                const excerpt = localizedString(story.excerpt);
                const categoryName = story.category ? localizedString(story.category.name) : null;
                const formattedDate = formatDate(story.publishAt ?? story.createdAt);

                return (
                  <article
                    key={story.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    {/* Cover Media */}
                    <Link
                      href={`/stories/${story.slug}`}
                      className="relative block aspect-[16/10] w-full overflow-hidden bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                    >
                      {story.coverMedia ? (
                        <CldImage
                          cloudName={cloudName}
                          publicId={story.coverMedia.publicId}
                          alt={title}
                          width={story.coverMedia.width ?? 800}
                          height={story.coverMedia.height ?? 500}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-forest-900/10 to-laterite-600/10 p-6 text-center">
                          <span className="font-heading text-xl text-forest-900/40">
                            Chawan Farms
                          </span>
                        </div>
                      )}

                      {categoryName && (
                        <span className="absolute left-4 top-4 rounded-full bg-forest-900/85 px-3 py-1 text-xs font-semibold text-cream-50 backdrop-blur-sm">
                          {categoryName}
                        </span>
                      )}
                    </Link>

                    {/* Card Content */}
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {formattedDate && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formattedDate}
                          </span>
                        )}
                        {story.authorName && (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {story.authorName}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 font-heading text-xl text-forest-900 transition-colors group-hover:text-forest-700 sm:text-2xl">
                        <Link
                          href={`/stories/${story.slug}`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                        >
                          {title}
                        </Link>
                      </h2>

                      {excerpt && (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {excerpt}
                        </p>
                      )}

                      <div className="mt-auto pt-6">
                        <Link
                          href={`/stories/${story.slug}`}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 transition group-hover:text-laterite-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                        >
                          Read Story <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </div>
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
