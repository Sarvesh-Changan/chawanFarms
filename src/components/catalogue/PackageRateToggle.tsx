"use client";

import { useMemo, useState } from "react";

import { formatINR } from "@/lib/money";

type Rate = { foodPreference: "VEG" | "NON_VEG" | null; audience: "ADULT" | "CHILD_4_10" | "INFANT_UNDER_4"; amountPaise: number; percentOfAdult: number | null };

function label(value: Rate["foodPreference"]): string {
  return value === "NON_VEG" ? "Non-veg" : "Veg";
}

export function PackageRateToggle({ rates }: { rates: Rate[] }) {
  const options = useMemo(() => [...new Set(rates.filter((rate) => rate.foodPreference).map((rate) => rate.foodPreference as "VEG" | "NON_VEG"))], [rates]);
  const [selected, setSelected] = useState<"VEG" | "NON_VEG" | null>(options[0] ?? null);
  const selectedRates = rates.filter((rate) => rate.audience === "ADULT" && (rate.foodPreference === selected || (selected === null && rate.foodPreference === null)));
  const adult = selectedRates[0];
  const child = rates.find((rate) => rate.audience === "CHILD_4_10" && (rate.foodPreference === selected || (selected === null && rate.foodPreference === null)));
  const infant = rates.find((rate) => rate.audience === "INFANT_UNDER_4" && (rate.foodPreference === selected || (selected === null && rate.foodPreference === null)));
  return <section className="bg-clay-100 rounded-2xl p-5 sm:p-7" aria-label="Package rates">
    {options.length ? <div className="flex flex-wrap gap-2" role="group" aria-label="Food preference">{options.map((option) => <button key={option} type="button" aria-pressed={selected === option} onClick={() => setSelected(option)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${selected === option ? "border-forest-700 bg-forest-700 text-cream-50" : "border-forest-900/20 text-forest-700"}`}>{label(option)}</button>)}</div> : null}
    <div className="mt-5">{adult ? <p className="text-forest-900 font-heading text-4xl">{formatINR(adult.amountPaise)} <span className="text-mist-500 font-sans text-sm font-normal">per person</span></p> : <p className="text-forest-900 font-heading text-2xl">Contact us for rates</p>}</div>
    {child || infant ? <div className="text-mist-500 mt-4 grid gap-1 text-sm">{child ? <p>Children 4–10: {child.percentOfAdult ? `${child.percentOfAdult}% of adult rate` : formatINR(child.amountPaise)}</p> : null}{infant?.amountPaise === 0 ? <p>Under 4: free</p> : null}</div> : null}
  </section>;
}
