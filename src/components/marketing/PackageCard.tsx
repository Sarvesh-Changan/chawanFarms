"use client";

import { Check, Leaf } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { formatINR } from "@/lib/money";
import { PROTOTYPE_IMAGE, type PrototypePackage } from "@/lib/prototype-data";

type PackageCardProps = { package: PrototypePackage };

export function PackageCard({ package: packageData }: PackageCardProps) {
  const [foodChoice, setFoodChoice] = useState<"veg" | "nonVeg">("veg");
  const price = foodChoice === "veg" ? packageData.vegPricePaise : packageData.nonVegPricePaise;

  return (
    <article className="bg-cream-50 border-forest-900/10 flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm">
      <div className="bg-clay-100 relative aspect-[4/3]">
        <Image src={PROTOTYPE_IMAGE} alt={packageData.imageAlt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        <span className="bg-cream-50 text-forest-700 absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold">{packageData.part}</span>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-heading text-forest-900 text-2xl leading-tight">{packageData.title}</h3>
        <p className="text-mist-500 mt-2 text-sm">{packageData.subtitle}</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Food choice">
          <button type="button" aria-pressed={foodChoice === "veg"} onClick={() => setFoodChoice("veg")} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${foodChoice === "veg" ? "border-leaf-500 bg-leaf-500/10 text-forest-700" : "border-forest-900/20 text-mist-500"}`}><Leaf aria-hidden="true" className="size-4" />Veg</button>
          <button type="button" aria-pressed={foodChoice === "nonVeg"} onClick={() => setFoodChoice("nonVeg")} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500 ${foodChoice === "nonVeg" ? "border-laterite-600 bg-laterite-600/10 text-laterite-600" : "border-forest-900/20 text-mist-500"}`}><span aria-hidden="true" className="size-2.5 rounded-full border-2 border-current" />Non-veg</button>
        </div>
        <div className="mt-4 min-h-16">
          {price !== null ? <p className="text-forest-900 font-heading text-3xl">{formatINR(price)} <span className="text-mist-500 font-sans text-sm font-normal">per person / day</span></p> : <p className="text-forest-900 font-heading text-2xl">Contact us <span className="text-mist-500 font-sans text-sm font-normal">for the confirmed rate</span></p>}
        </div>
        <ul className="border-forest-900/10 mt-4 grid gap-2 border-t pt-4 text-sm" aria-label="Package inclusions">
          {packageData.inclusions.map((item) => <li className="flex gap-2" key={item}><Check aria-hidden="true" className="text-leaf-500 mt-0.5 size-4 shrink-0" /><span>{item}</span></li>)}
        </ul>
        {packageData.conditions.length > 0 ? <div className="bg-clay-100 text-forest-900 mt-5 rounded-lg p-3 text-xs leading-5"><strong>Conditions:</strong> {packageData.conditions.join(" · ")}</div> : null}
        <Link href={`/book?package=${packageData.id}`} className="bg-forest-700 text-cream-50 mt-6 inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Enquire about this package</Link>
      </div>
    </article>
  );
}
