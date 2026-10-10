"use client";

import { useMemo, useState } from "react";

type Preference = "VEG" | "NON_VEG" | null;
type Item = { id: string; name: string; description: string; foodPreference: Preference; isExtraCharge: boolean; extraUnitLabel: string | null };
type Category = { id: string; name: string; items: Item[] };

export function FoodMenu({ categories }: { categories: Category[] }) {
  const [filter, setFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");
  const visibleCategories = useMemo(() => categories.map((category) => ({ ...category, items: category.items.filter((item) => filter === "ALL" || item.foodPreference === null || item.foodPreference === filter) })).filter((category) => category.items.length), [categories, filter]);
  return <div>
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Food preference filter">{(["ALL", "VEG", "NON_VEG"] as const).map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${filter === option ? "border-forest-700 bg-forest-700 text-cream-50" : "border-forest-900/20 text-forest-700"}`}>{option === "ALL" ? "All" : option === "VEG" ? "Veg" : "Non-veg"}</button>)}</div>
    {visibleCategories.length ? <div className="grid gap-3 md:grid-cols-2">{visibleCategories.map((category) => <details key={category.id} className="bg-clay-100 rounded-xl p-5" open><summary className="cursor-pointer font-semibold">{category.name}</summary><ul className="mt-4 grid gap-3 border-t border-forest-900/10 pt-4 text-sm">{category.items.map((item) => <li key={item.id} className="flex items-start justify-between gap-4"><span><span className="font-medium">{item.name}</span>{item.description ? <span className="text-mist-500 mt-1 block text-xs">{item.description}</span> : null}</span>{item.isExtraCharge ? <span className="bg-turmeric-500 text-ink-900 shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase">Extra{item.extraUnitLabel ? ` · ${item.extraUnitLabel}` : ""}</span> : null}</li>)}</ul></details>)}</div> : <p className="bg-clay-100 text-mist-500 rounded-2xl p-8 text-center text-sm">No published menu items match this filter.</p>}
  </div>;
}
