import type { ReactNode } from "react";

import { ClosingCta } from "@/components/marketing/ClosingCta";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { PublicPageHeader } from "@/components/marketing/PublicPageHeader";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { getPublicSettings } from "@/server/services/public-content";

export async function CatalogueFrame({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  return <><Header />{children}<ClosingCta settings={settings}/><StickyCtaBar /><Footer /></>;
}

export function CatalogueIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <PublicPageHeader eyebrow={eyebrow} title={title} description={description} currentPage={title} />;
}
