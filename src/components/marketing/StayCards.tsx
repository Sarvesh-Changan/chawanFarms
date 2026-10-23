"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FilterTabs } from "@/components/marketing/FilterTabs";
import { MetaRow } from "@/components/marketing/MetaRow";
import { TagChip } from "@/components/marketing/TagChip";
import { CldImage } from "@/components/media/CldImage";
import { filterStayPackages, stayCategories, type StayCardData } from "@/lib/stay-catalogue";
import { cn } from "@/lib/utils";

function StayCard({ item, cloudName }: { item: StayCardData; cloudName: string }) {
  return <article className="stay-card-reveal group bg-cream-50 border-forest-900/10 relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border shadow-sm transition-transform duration-[var(--motion-duration-ui)] ease-[var(--motion-ease-standard)] hover:-translate-y-1 focus-within:-translate-y-1" style={{ animationDelay: `${Number(item.number) * 80 - 80}ms` }}>
    <div className="bg-clay-100 relative aspect-[4/3] overflow-hidden">
      {item.image && cloudName ? <CldImage cloudName={cloudName} publicId={item.image.publicId} resourceType={item.image.resourceType} alt={item.image.alt} focalX={item.image.focalX} focalY={item.image.focalY} fill sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-[var(--motion-duration-ui)] ease-[var(--motion-ease-standard)] group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:transform-none"/> : null}
      <span className="bg-cream-50 text-forest-700 absolute top-4 left-4 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold" aria-label={`Stay ${item.number}`}>{item.number}</span>
    </div>
    <div className="flex flex-1 flex-col p-5 sm:p-6">
      <MetaRow className="min-h-8" items={[item.category ? <TagChip key="category">{item.category.label}</TagChip> : null, ...item.foodOptions.map((option) => <TagChip key={option}>{option}</TagChip>), item.groupNote ? <TagChip key="group">{item.groupNote}</TagChip> : null]}/>
      <h3 className="font-heading text-forest-900 mt-4 text-2xl leading-tight"><Link href={`/packages/${item.slug}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">{item.title}</Link></h3>
      {item.description ? <p className="text-mist-500 mt-2 line-clamp-3 text-sm leading-6">{item.description}</p> : null}
      <div className="mt-5 min-h-14"><p className={cn("font-heading text-forest-900", item.priceLabel.startsWith("from ") ? "text-2xl" : "text-xl")}>{item.priceLabel}</p></div>
      {item.childLabel || item.infantLabel ? <div className="text-mist-500 mt-3 grid gap-1 text-xs">{item.childLabel ? <p>{item.childLabel}</p> : null}{item.infantLabel ? <p>{item.infantLabel}</p> : null}</div> : null}
      <div className="mt-auto flex flex-wrap gap-3 pt-6"><Link href={`/packages/${item.slug}`} className="text-forest-700 inline-flex min-h-11 items-center gap-2 rounded-md font-semibold underline-offset-4 transition-transform hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 group-hover:translate-x-0.5 group-focus-within:translate-x-0.5">View stay <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-focus-within:translate-x-0.5 group-focus-within:-translate-y-0.5"/></Link><Link href={`/book?package=${encodeURIComponent(item.id)}`} className="bg-forest-700 text-cream-50 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Enquire</Link></div>
    </div>
  </article>;
}

export function StayCards({ items, cloudName, showFilters = true }: { items: readonly StayCardData[]; cloudName: string; showFilters?: boolean }) {
  const categories = stayCategories(items);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const visibleItems = filterStayPackages(items, selectedCategory);

  if (!items.length) return <p className="bg-clay-100 text-mist-500 mt-10 rounded-[var(--radius-card)] p-8 text-center text-sm">No published stays are available yet.</p>;

  return <div>
    {showFilters && categories.length > 1 ? <FilterTabs items={categories} ariaLabel="Filter stays" value={selectedCategory} onChange={setSelectedCategory} className="mt-8"/> : null}
    {visibleItems.length ? <div className="mt-10 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">{visibleItems.map((item) => <StayCard key={item.id} item={item} cloudName={cloudName}/>)}</div> : <p className="bg-clay-100 text-mist-500 mt-10 rounded-[var(--radius-card)] p-8 text-center text-sm">No stays match this category.</p>}
    {showFilters ? <p className="text-mist-500 mt-5 text-xs" role="status" aria-live="polite">Showing {visibleItems.length} of {items.length} stays.</p> : null}
  </div>;
}
