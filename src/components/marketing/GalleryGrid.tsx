"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { prototypeGallery, PROTOTYPE_IMAGE } from "@/lib/prototype-data";

const categories = ["All", ...new Set(prototypeGallery.map((item) => item.category))];

export function GalleryGrid() {
  const [filter, setFilter] = useState("All");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const filtered = prototypeGallery.filter((item) => filter === "All" || item.category === filter);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowRight") setSelectedIndex((current) => current === null ? 0 : (current + 1) % filtered.length);
      if (event.key === "ArrowLeft") setSelectedIndex((current) => current === null ? 0 : (current - 1 + filtered.length) % filtered.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filtered.length, selectedIndex]);

  const selected = selectedIndex === null ? null : filtered.at(selectedIndex);

  return (
    <div>
      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Gallery categories">
        {categories.map((category) => <button type="button" role="tab" aria-selected={filter === category} onClick={() => { setFilter(category); setSelectedIndex(null); }} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${filter === category ? "border-forest-700 bg-forest-700 text-cream-50" : "border-forest-900/15 text-forest-700 hover:bg-clay-100"}`} key={category}>{category}</button>)}
      </div>
      <div className="grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] sm:grid-cols-3">
        {filtered.map((item, index) => <button type="button" onClick={() => setSelectedIndex(index)} className={`bg-clay-100 group relative overflow-hidden rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 ${index === 0 ? "row-span-2" : ""}`} key={item.id} aria-label={`Open ${item.title} image`}><Image src={PROTOTYPE_IMAGE} alt={item.imageAlt} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" /><span className="from-forest-900/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-4 pt-10 pb-3 text-sm font-semibold text-cream-50">{item.title}</span></button>)}
      </div>
      {selected ? <div className="fixed inset-0 z-[60] grid place-items-center bg-night-900/95 p-4" role="dialog" aria-modal="true" aria-label={`${selected.title} gallery image`}><div className="relative w-full max-w-4xl"><div className="relative aspect-video overflow-hidden rounded-xl bg-clay-100"><Image src={PROTOTYPE_IMAGE} alt={selected.imageAlt} fill sizes="100vw" className="object-contain" /></div><p className="text-cream-50/80 mt-3 text-center text-sm">{selected.title} · {selected.category}</p><button type="button" onClick={() => setSelectedIndex(null)} className="bg-cream-50 text-forest-900 absolute -top-2 -right-2 grid size-11 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-turmeric-500" aria-label="Close gallery"><X aria-hidden="true" className="size-5" /></button><button type="button" onClick={() => setSelectedIndex((selectedIndex === null ? 0 : (selectedIndex - 1 + filtered.length) % filtered.length))} className="bg-cream-50 text-forest-900 absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-turmeric-500" aria-label="Previous image"><ChevronLeft aria-hidden="true" /></button><button type="button" onClick={() => setSelectedIndex((selectedIndex === null ? 0 : (selectedIndex + 1) % filtered.length))} className="bg-cream-50 text-forest-900 absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-turmeric-500" aria-label="Next image"><ChevronRight aria-hidden="true" /></button></div></div> : null}
    </div>
  );
}
