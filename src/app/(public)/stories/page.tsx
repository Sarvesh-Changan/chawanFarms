import { ArrowRight, Calendar, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { PublicClosing } from "@/components/marketing/PublicClosing";
import { PublicPageHeader } from "@/components/marketing/PublicPageHeader";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { isPublicImage } from "@/lib/marketing-media";
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
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? env.CLOUDINARY_CLOUD_NAME ?? "";

  return (
    <>
      <Header />
      <PublicPageHeader currentPage="Stories" eyebrow="Stories from the farm" title="Tales from Baitwadi & the Sahyadris" description="Published stories and reflections from Chawan Farms." />
      <main className="min-h-screen bg-cream-50/60 pb-20 pt-12 sm:pt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Stories Grid */}
          {stories.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <h2 className="font-heading text-2xl text-forest-900">
                No published stories are available yet.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Published stories from the farm team will appear here.
              </p>
              <div className="mt-6">
                <Link
                  href="/activities"
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
                      {isPublicImage(story.coverMedia) && cloudName ? (
                        <CldImage
                          cloudName={cloudName}
                          publicId={story.coverMedia.publicId}
                          alt={localizedString(story.coverMedia.altText)}
                          width={story.coverMedia.width ?? 800}
                          height={story.coverMedia.height ?? 500}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : <div data-image-placeholder="story-cover" aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_18%,rgb(183_201_107_/.3),transparent_30%),linear-gradient(145deg,#d9ddc4,#b7c96b_55%,#66815a)]" />}

                      <span className="absolute left-4 top-4 rounded-full bg-forest-900/85 px-3 py-1 text-xs font-semibold text-cream-50 backdrop-blur-sm">
                        {story.kind === "GUEST" ? "Guest story" : story.kind === "EXPERIENCE" ? "Farm experience" : "Story"}
                      </span>
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
      <PublicClosing />
      <StickyCtaBar />
      <Footer />
    </>
  );
}
