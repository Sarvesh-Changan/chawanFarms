import type { MetadataRoute } from "next";

import { env } from "@/config/env";
import { getPublicActivities, getPublicAccommodations, getPublicPackages, getPublicStories } from "@/server/services/public-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  // /experiences remains a legacy redirect to /stories and is intentionally not canonical.
  const staticRoutes = ["", "/accommodation", "/packages", "/food", "/activities", "/gallery", "/stories", "/rewards", "/contact", "/book"];
  const [accommodations, packages, activities, stories] = await Promise.all([getPublicAccommodations(), getPublicPackages(), getPublicActivities(), getPublicStories()]);
  return [
    ...staticRoutes.map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const })),
    ...accommodations.map((item) => ({ url: `${base}/accommodation/${item.slug}`, changeFrequency: "weekly" as const })),
    ...packages.map((item) => ({ url: `${base}/packages/${item.slug}`, changeFrequency: "weekly" as const })),
    ...activities.map((item) => ({ url: `${base}/activities/${item.slug}`, changeFrequency: "weekly" as const })),
    ...stories.map((item) => ({ url: `${base}/stories/${item.slug}`, changeFrequency: "weekly" as const })),
  ];
}
