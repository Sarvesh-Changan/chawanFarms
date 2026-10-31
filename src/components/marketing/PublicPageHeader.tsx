import { Breadcrumbs } from "@/components/marketing/Breadcrumbs";

export function PublicPageHeader({ eyebrow, title, description, currentPage }: { eyebrow: string; title: string; description?: string; currentPage: string }) {
  return <section className="bg-forest-900 text-cream-50 rounded-b-[2rem] sm:rounded-b-[3rem]">
    <Breadcrumbs items={[{ label: currentPage }]} className="text-cream-50/70" />
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
      <p className="text-paddy-300 text-xs font-semibold tracking-[0.18em] uppercase">{eyebrow}</p>
      <h1 className="font-heading mt-4 max-w-4xl text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.98] tracking-[-0.035em]">{title}</h1>
      {description ? <p className="text-cream-50/80 mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">{description}</p> : null}
    </div>
  </section>;
}
