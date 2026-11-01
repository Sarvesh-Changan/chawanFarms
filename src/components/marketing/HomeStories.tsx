import { Play } from "lucide-react";
import Link from "next/link";

import { CldImage } from "@/components/media/CldImage";
import { Stagger } from "@/components/motion/Stagger";
import { env } from "@/config/env";
import { isPublicImage } from "@/lib/marketing-media";
import type { PublicHomeData } from "@/server/services/public-content";

function localized(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

export function HomeStories({ stories }: { stories?: PublicHomeData["stories"] }) {
  const ready = (stories ?? []).filter((story) => isPublicImage(story.coverMedia) || story.videoMedia).slice(0, 3);
  if (!ready.length) return null;

  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  return (
    <section
      id="stories"
      aria-labelledby="home-stories-heading"
      className="bg-[#EEF2D6] text-forest-900 rounded-t-[2.5rem] sm:rounded-t-[3.5rem] py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-leaf-500 font-mono text-xs font-semibold tracking-widest uppercase">
            {"// STORIES"}
          </p>
          <h2
            id="home-stories-heading"
            className="font-heading mt-2 text-3xl sm:text-4xl lg:text-5xl text-forest-900"
          >
            From days spent at the farm
          </h2>
        </div>

        <Stagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ready.map((story) => {
            const title = localized(story.title);
            const isGuest = Boolean(story.sourceSubmissionId || story.category?.slug === "guest-stories");
            const tag = isGuest ? "Guest story" : "Farm story";
            const hasVideo = Boolean(story.videoMedia);

            return (
              <article
                key={story.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-cream-50 border border-forest-900/10 shadow-sm transition-[transform,box-shadow] duration-200 ease-[var(--motion-ease-standard)] hover:-translate-y-1 hover:shadow-lg focus-within:-translate-y-1"
              >
                <Link
                  href={`/stories/${story.slug}`}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
                  aria-label={`${title} (${tag})`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-clay-100">
                    {story.coverMedia && cloudName ? (
                      <CldImage
                        cloudName={cloudName}
                        publicId={story.coverMedia.publicId}
                        resourceType="image"
                        alt={localized(story.coverMedia.altText) || title}
                        focalX={story.coverMedia.focalX}
                        focalY={story.coverMedia.focalY}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 ease-[var(--motion-ease-standard)] group-hover:scale-105 motion-reduce:transform-none"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-forest-900/10 text-forest-900/40 font-heading text-lg">
                        {title}
                      </div>
                    )}

                    {/* Play Button Overlay for Videos */}
                    {hasVideo ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-forest-900/25 transition-colors group-hover:bg-forest-900/15">
                        <span className="flex size-14 items-center justify-center rounded-full bg-cream-50/95 text-forest-900 shadow-lg backdrop-blur-xs transition-transform duration-200 group-hover:scale-110">
                          <Play aria-hidden="true" className="size-6 fill-forest-900 translate-x-0.5" />
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="p-5 sm:p-6">
                    <span className="inline-block rounded-full bg-[#EEF2D6] px-3 py-1 text-xs font-semibold text-forest-800">
                      {tag}
                    </span>
                    <h3 className="font-heading mt-3 text-xl sm:text-2xl text-forest-900 leading-snug group-hover:text-laterite-600 transition-colors">
                      {title}
                    </h3>
                  </div>
                </Link>
              </article>
            );
          })}
        </Stagger>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-forest-900/10 pt-6">
          <p className="text-xs text-forest-900/70">
            Guest videos appear only after approval and with the guest&apos;s consent.
          </p>
          <Link
            href="/stories"
            className="text-forest-700 hover:text-laterite-600 font-semibold text-sm inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-turmeric-500 rounded-sm"
          >
            View all stories <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
