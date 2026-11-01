import Link from "next/link";

import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import { isMarketingPhoto } from "@/lib/marketing-media";
import type { PublicActivity } from "@/server/services/public-content";

function localized(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function ActivityIcon({ slug }: { slug: string }) {
  if (slug.includes("campfire")) {
    return (
      <svg className="size-8 text-turmeric-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.5 3-4 5.5-4 9a6 6 0 1012 0c0-3.5-2.5-6-4-9-1 2-2 3-4 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    );
  }
  if (slug.includes("mountain") || slug.includes("trek")) {
    return (
      <svg className="size-8 text-paddy-300" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8 18 4-8 4 8m-9-3 3-6 2 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
      </svg>
    );
  }
  if (slug.includes("rafting") || slug.includes("river") || slug.includes("water")) {
    return (
      <svg className="size-8 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 15c3-1.5 6-1.5 9 0s6 1.5 9 0M2 19c3-1.5 6-1.5 9 0s6 1.5 9 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-4 5 4M12 7v5" />
      </svg>
    );
  }
  if (slug.includes("jungle") || slug.includes("trail")) {
    return (
      <svg className="size-8 text-leaf-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22v-6m0 0a5 5 0 01-5-5c0-3 2.5-5 5-8 2.5 3 5 5 5 8a5 5 0 01-5 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 17c1.5-1.5 3-2 5-2m6 0c2 0 3.5.5 5 2" />
      </svg>
    );
  }
  if (slug.includes("star") || slug.includes("gazing")) {
    return (
      <svg className="size-8 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 6.9L21 9.8l-5.3 4.5 1.6 7.2L12 17.8 6.7 21.5l1.6-7.2L3 9.8l6.6-.9L12 2z" />
      </svg>
    );
  }
  if (slug.includes("fishing")) {
    return (
      <svg className="size-8 text-sky-300" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 12c-3.5 0-6.5-1.5-8-4 0 4 3 8 8 8m0-4c1.5 1 2 2.5 2 4s-.5 3-2 4" />
        <circle cx="16" cy="10" r="1" fill="currentColor" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4c4 4 4 10 4 16" />
      </svg>
    );
  }
  if (slug.includes("bullock") || slug.includes("cart")) {
    return (
      <svg className="size-8 text-turmeric-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m-8-8h4m8 0h4m-2.8-5.7l-2.8 2.8m-5.7 5.7l-2.8 2.8m11.3 0l-2.8-2.8m-5.7-5.7L4.7 6.3" />
      </svg>
    );
  }
  return (
    <svg className="size-8 text-paddy-300" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
    </svg>
  );
}

export function ActivitiesRow({ activities }: { activities?: readonly PublicActivity[] }) {
  if (!activities?.length) return null;

  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  return (
    <section
      id="activities"
      aria-labelledby="activities-heading"
      className="relative isolate overflow-hidden bg-[#0C1620] text-cream-50 py-10 sm:py-12"
    >
      {/* Soft CSS Twinkle Stars (disabled on reduced-motion) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span className="absolute top-[18%] left-[12%] size-1 rounded-full bg-cream-50/70 animate-pulse motion-reduce:animate-none" style={{ animationDuration: "3.2s" }} />
        <span className="absolute top-[28%] right-[15%] size-1.5 rounded-full bg-turmeric-500/70 animate-pulse motion-reduce:animate-none" style={{ animationDuration: "4s", animationDelay: "1s" }} />
        <span className="absolute top-[65%] left-[22%] size-1 rounded-full bg-cream-50/60 animate-pulse motion-reduce:animate-none" style={{ animationDuration: "2.6s", animationDelay: "0.5s" }} />
        <span className="absolute top-[72%] right-[28%] size-1 rounded-full bg-paddy-300/70 animate-pulse motion-reduce:animate-none" style={{ animationDuration: "3.6s", animationDelay: "1.8s" }} />
        <span className="absolute top-[42%] left-[48%] size-1.5 rounded-full bg-cream-50/50 animate-pulse motion-reduce:animate-none" style={{ animationDuration: "4.5s", animationDelay: "2.2s" }} />
        <span className="absolute top-[80%] right-[8%] size-1 rounded-full bg-amber-200/60 animate-pulse motion-reduce:animate-none" style={{ animationDuration: "3s", animationDelay: "0.8s" }} />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
        <div className="text-center">
          <p className="text-turmeric-500 font-mono text-xs font-semibold tracking-widest uppercase">
            {"// ACTIVITIES"}
          </p>
          <h2
            id="activities-heading"
            className="font-heading mt-2 text-2xl sm:text-3xl lg:text-4xl text-cream-50"
          >
            Days outdoors, nights under the stars
          </h2>
        </div>

        {/* Circular Row of Activities (Snap scroll on mobile, flex row on desktop) */}
        <div className="mt-8 flex items-center justify-start sm:justify-center gap-6 sm:gap-8 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 no-scrollbar">
          {activities.map((activity) => {
            const hasMedia = isMarketingPhoto(activity.heroMedia) && cloudName;
            const name = localized(activity.name);
            const isExtra = activity.isExtraCost;

            return (
              <div
                key={activity.id}
                className="group flex flex-col items-center shrink-0 snap-center text-center w-24 sm:w-28"
              >
                <div className="relative size-16 sm:size-20 rounded-full border border-cream-50/20 bg-forest-900/60 p-1 shadow-md transition-transform duration-200 ease-[var(--motion-ease-standard)] group-hover:scale-105 group-hover:border-turmeric-500/80">
                  <div className="relative size-full rounded-full overflow-hidden flex items-center justify-center bg-[#152535]">
                    {hasMedia && activity.heroMedia ? (
                      <CldImage
                        cloudName={cloudName}
                        publicId={activity.heroMedia.publicId}
                        resourceType="image"
                        alt={name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <ActivityIcon slug={activity.slug} />
                    )}
                  </div>
                </div>

                <p className="mt-3 text-xs sm:text-sm font-medium text-cream-50/90 leading-tight">
                  {name}
                  {isExtra ? (
                    <span className="block text-[11px] text-turmeric-500 font-normal mt-0.5">(extra)</span>
                  ) : null}
                </p>
              </div>
            );
          })}
        </div>

        {/* Supporting notice and link */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cream-50/70 border-t border-cream-50/10 pt-4">
          <p>Arranged according to prevailing conditions and availability.</p>
          <Link
            href="/activities"
            className="text-turmeric-500 hover:text-turmeric-400 font-semibold inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-turmeric-500 rounded-sm"
          >
            Explore all activities <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

