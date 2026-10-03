"use client";

import { useState } from "react";

import { prototypeFood } from "@/lib/prototype-data";

export function FoodSection() {
  const [menu, setMenu] = useState<"veg" | "nonVeg">("veg");
  const lunch = menu === "veg" ? prototypeFood.vegLunchDinner : prototypeFood.nonVegLunchDinner;
  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div className="bg-forest-900 text-cream-50 rounded-[1.5rem] p-6 sm:p-8">
        <p className="text-paddy-300 text-xs font-semibold tracking-[0.2em] uppercase">The farm kitchen</p>
        <h3 className="font-heading mt-3 text-4xl leading-tight">Meals with a little more soil under them.</h3>
        <p className="text-cream-50/75 mt-5 text-base leading-7">The PDF menu is the source for this prototype. Final menus and availability stay with the team.</p>
        <div className="mt-8 grid grid-cols-2 gap-2 rounded-lg bg-cream-50/10 p-1" role="group" aria-label="Food menu choice">
          <button type="button" aria-pressed={menu === "veg"} onClick={() => setMenu("veg")} className={`min-h-11 rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${menu === "veg" ? "bg-turmeric-500 text-ink-900" : "text-cream-50"}`}>Veg menu</button>
          <button type="button" aria-pressed={menu === "nonVeg"} onClick={() => setMenu("nonVeg")} className={`min-h-11 rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${menu === "nonVeg" ? "bg-turmeric-500 text-ink-900" : "text-cream-50"}`}>Non-veg menu</button>
        </div>
      </div>
      <div className="grid gap-3">
        <details open className="bg-clay-100 group rounded-xl p-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold marker:hidden">Lunch / dinner <span aria-hidden="true" className="text-laterite-600 text-xl">+</span></summary><ul className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm sm:grid-cols-2">{lunch.map((item) => <li className="flex gap-2" key={item}><span className="text-leaf-500" aria-hidden="true">•</span>{item}</li>)}</ul></details>
        <details className="bg-clay-100 group rounded-xl p-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold marker:hidden">Breakfast <span aria-hidden="true" className="text-laterite-600 text-xl">+</span></summary><div className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm sm:grid-cols-2"><p>Veg: {prototypeFood.vegBreakfast.join(" · ")}</p><p>Non-veg adds: {prototypeFood.nonVegBreakfast.join(" · ")}</p></div></details>
        <details className="bg-clay-100 group rounded-xl p-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold marker:hidden">Extras <span aria-hidden="true" className="text-laterite-600 text-xl">+</span></summary><ul className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm">{prototypeFood.extras.map((item) => <li className="flex gap-2" key={item}><span className="bg-turmeric-500 text-ink-900 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">Extra</span>{item}</li>)}</ul></details>
      </div>
    </div>
  );
}
