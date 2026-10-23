import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/marketing/Breadcrumbs";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { getPublicSettings } from "@/server/services/public-content";

export async function CatalogueFrame({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  return <><Header />{children}<ClosingCta settings={settings}/><StickyCtaBar /><Footer /></>;
}

export function CatalogueIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <section className="bg-forest-900 text-cream-50"><Breadcrumbs items={[{ label: title }]} className="text-cream-50/65"/><div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-20 lg:px-12 lg:py-24"><p className="text-paddy-300 text-xs font-semibold tracking-[0.2em] uppercase"><span aria-hidden="true">{"// "}</span>{eyebrow}</p><h1 className="font-heading mt-4 max-w-4xl text-[clamp(2.75rem,8vw,6rem)] leading-[0.95]">{title}</h1>{description ? <p className="text-cream-50/75 mt-6 max-w-2xl text-lg leading-8">{description}</p> : null}</div></section>;
}
