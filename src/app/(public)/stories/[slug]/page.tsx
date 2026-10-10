import { ArrowLeft, Calendar, Share2, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { CldImage } from "@/components/media/CldImage";
import { JsonLd } from "@/components/seo/JsonLd";
import { env } from "@/config/env";
import { getPublicSeoForSlug, metadataFromSeo } from "@/server/services/cms/seo";
import { getPublicStoryBySlug, localizedString } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = await getPublicStoryBySlug(slug);
  const title = story ? localizedString(story.title) : "Story";
  const excerpt = story ? localizedString(story.excerpt) : "Farm story from Chawan Farms";

  const fallback: Metadata = {
    title: `${title} · Chawan Farms`,
    description: excerpt,
  };

  return metadataFromSeo(await getPublicSeoForSlug("post", slug), fallback);
}

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = await getPublicStoryBySlug(slug);

  if (!story) {
    notFound();
  }

  const title = localizedString(story.title);
  const excerpt = localizedString(story.excerpt);
  const body = localizedString(story.body);
  const categoryName = story.category ? localizedString(story.category.name) : null;
  const formattedDate = formatDate(story.publishAt ?? story.createdAt);
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
  const pageUrl = `${env.NEXT_PUBLIC_SITE_URL}/stories/${story.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: excerpt,
    datePublished: story.publishAt ? new Date(story.publishAt).toISOString() : undefined,
    dateModified: new Date(story.updatedAt).toISOString(),
    author: story.authorName
      ? {
          "@type": "Person",
          name: story.authorName,
        }
      : {
          "@type": "Organization",
          name: "Chawan Farms",
        },
    publisher: {
      "@type": "Organization",
      name: "Chawan Farms",
      url: env.NEXT_PUBLIC_SITE_URL,
    },
    mainEntityOfPage: pageUrl,
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Header />
      <main className="min-h-screen bg-cream-50/60 pb-20 pt-8 sm:pt-12">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Back Navigation */}
          <div className="mb-8">
            <Link
              href="/stories"
              className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 transition hover:text-laterite-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back to all stories
            </Link>
          </div>

          {/* Article Header */}
          <header className="space-y-4">
            {categoryName && (
              <span className="inline-block rounded-full bg-forest-900/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-forest-900">
                {categoryName}
              </span>
            )}

            <h1 className="font-heading text-3xl text-forest-900 sm:text-4xl md:text-5xl lg:text-6xl">
              {title}
            </h1>

            {excerpt && (
              <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {excerpt}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-6 border-y border-border/80 py-4 text-sm text-muted-foreground">
              {formattedDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-forest-700" />
                  <span>{formattedDate}</span>
                </div>
              )}
              {story.authorName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-forest-700" />
                  <span>By {story.authorName}</span>
                </div>
              )}
            </div>
          </header>

          {/* Featured Cover Media */}
          {story.coverMedia && (
            <div className="my-10 overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-sm">
              <CldImage
                cloudName={cloudName}
                publicId={story.coverMedia.publicId}
                alt={title}
                width={story.coverMedia.width ?? 1200}
                height={story.coverMedia.height ?? 700}
                className="h-auto w-full object-cover"
                sizes="(max-width: 896px) 100vw, 896px"
                priority
              />
            </div>
          )}

          {/* Body Content */}
          <div className="prose prose-lg prose-forest mx-auto max-w-none text-foreground/90">
            {body ? (
              <SafeHtml html={body} />
            ) : (
              <p className="text-muted-foreground">No article text provided.</p>
            )}
          </div>

          {/* Share & Engage Section */}
          <footer className="mt-14 border-t border-border/80 pt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Share2 className="h-4 w-4 text-forest-700" />
                <span>Share this chronicle with friends or family</span>
              </div>
              <div className="flex gap-3">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `${title} — Read this story from Chawan Farms: ${pageUrl}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Share on WhatsApp
                </a>
              </div>
            </div>

            {/* Visit Farm CTA Box */}
            <div className="mt-10 rounded-2xl border border-forest-900/15 bg-gradient-to-br from-forest-900/5 to-clay-100/50 p-8 sm:p-10 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-laterite-600">
                Experience It In Person
              </span>
              <h2 className="mt-2 font-heading text-2xl text-forest-900 sm:text-3xl">
                Ready to slow down at Chawan Farms?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Book a weekend stay or plan a day visit with authentic meals, river
                swimming, mountain treks, and starry nights.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  href="/packages"
                  className="rounded-full bg-forest-900 px-6 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Explore Packages
                </Link>
                <Link
                  href="/contact"
                  className="rounded-full border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  Contact Farm Team
                </Link>
              </div>
            </div>
          </footer>
        </article>
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
