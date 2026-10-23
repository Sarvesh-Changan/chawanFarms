"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const legacyHashRoutes: Record<string, string> = {
  experience: "/experiences",
  experiences: "/experiences",
  accommodation: "/accommodation",
  packages: "/packages",
  food: "/food",
  activities: "/activities",
  gallery: "/gallery",
  stories: "/stories",
  rewards: "/rewards",
  location: "/contact#find-us",
};

export function routeForLegacyHash(hash: string) {
  return legacyHashRoutes[hash.replace(/^#/, "").toLowerCase()] ?? null;
}

export function LegacyHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const route = routeForLegacyHash(window.location.hash);
    if (route) router.replace(route);
  }, [router]);
  return null;
}
