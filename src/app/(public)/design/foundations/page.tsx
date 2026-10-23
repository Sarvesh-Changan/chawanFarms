import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FoundationsShowcase } from "@/components/marketing/FoundationsShowcase";
import { env } from "@/config/env";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Marketing foundations",
};

export default function FoundationsPage() {
  if (env.APP_ENV === "production" || env.NODE_ENV === "production") {
    notFound();
  }

  return <FoundationsShowcase />;
}
