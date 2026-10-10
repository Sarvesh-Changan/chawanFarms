"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CldImage } from "@/components/media/CldImage";

export type HomeGalleryItem = {
  id: string;
  category: string;
  caption: string;
  publicId: string;
  alt: string;
};

export function HomeGallery({ cloudName, items }: { cloudName: string; items: HomeGalleryItem[] }) {
  const categories = useMemo(() => ["All", ...new Set(items.map((item) => item.category))], [items]);
  const [category, setCategory] = useState("All");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const filtered = items.filter((item) => category === "All" || item.category === category);
  const selected = selectedIndex === null ? null : filtered.find((_, index) => index === selectedIndex) ?? null;

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowRight") setSelectedIndex((index) => index === null || !filtered.length ? null : (index + 1) % filtered.length);
      if (event.key === "ArrowLeft") setSelectedIndex((index) => index === null || !filtered.length ? null : (index - 1 + filtered.length) % filtered.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filtered.length, selectedIndex]);

  if (!items.length) return <p className="bg-clay-100 text-mist-500 rounded-2xl p-8 text-center text-sm">No gallery items are published yet.</p>;

  return <div>
    <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Gallery categories">
      {categories.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => { setCategory(item); setSelectedIndex(null); }} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${category === item ? "border-forest-700 bg-forest-700 text-cream-50" : "border-forest-900/15 text-forest-700 hover:bg-clay-100"}`}>{item}</button>)}
    </div>
    <div className="grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[14rem] sm:grid-cols-3">
      {filtered.map((item, index) => <button key={item.id} type="button" onClick={() => setSelectedIndex(index)} className={`bg-clay-100 group relative overflow-hidden rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 ${index === 0 ? "row-span-2" : ""}`} aria-label={`Open ${item.alt}`}>
        <CldImage cloudName={cloudName} publicId={item.publicId} alt={item.alt} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
        <span className="from-forest-900/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-4 pt-10 pb-3 text-sm font-semibold text-cream-50">{item.caption || item.category}</span>
      </button>)}
    </div>
    {selected ? <div className="fixed inset-0 z-[60] grid place-items-center bg-night-900/95 p-4" role="dialog" aria-modal="true" aria-label={selected.alt}>
      <div className="relative w-full max-w-4xl">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-clay-100"><CldImage cloudName={cloudName} publicId={selected.publicId} alt={selected.alt} fill sizes="100vw" className="object-contain" /></div>
        <p className="text-cream-50/80 mt-3 text-center text-sm">{selected.caption || selected.category}</p>
        <button type="button" onClick={() => setSelectedIndex(null)} className="bg-cream-50 text-forest-900 absolute -top-2 -right-2 grid size-11 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-turmeric-500" aria-label="Close gallery"><X aria-hidden="true" className="size-5" /></button>
        {filtered.length > 1 ? <>
          <button type="button" onClick={() => setSelectedIndex((index) => index === null ? 0 : (index - 1 + filtered.length) % filtered.length)} className="bg-cream-50 text-forest-900 absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-turmeric-500" aria-label="Previous image"><ChevronLeft aria-hidden="true" /></button>
          <button type="button" onClick={() => setSelectedIndex((index) => index === null ? 0 : (index + 1) % filtered.length)} className="bg-cream-50 text-forest-900 absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-turmeric-500" aria-label="Next image"><ChevronRight aria-hidden="true" /></button>
        </> : null}
      </div>
    </div> : null}
  </div>;
}
