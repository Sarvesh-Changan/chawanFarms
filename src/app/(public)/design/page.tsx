import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DesignSystemShowcase } from "@/components/marketing/DesignSystemShowcase";
import { env } from "@/config/env";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Design foundation",
};

export default function DesignPage() {
  if (env.APP_ENV === "production" || env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignSystemShowcase />;
}
