import Image from "next/image";

import { prototypeAccommodation, PROTOTYPE_IMAGE } from "@/lib/prototype-data";

export function AccommodationShowcase() {
  return (
    <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
      {prototypeAccommodation.map((item, index) => (
        <article className={`bg-clay-100 overflow-hidden rounded-2xl ${index === 0 ? "md:row-span-2" : ""}`} key={item.title}>
          <div className={`relative ${index === 0 ? "aspect-[4/5] md:h-full" : "aspect-[16/9]"}`}>
            <Image src={PROTOTYPE_IMAGE} alt={item.imageAlt} fill sizes={index === 0 ? "(min-width: 768px) 55vw, 100vw" : "(min-width: 768px) 45vw, 100vw"} className="object-cover" />
            <div className="from-forest-900/75 absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent" />
            <div className="absolute right-0 bottom-0 left-0 p-5 text-cream-50 sm:p-6">
              <h3 className="font-heading text-2xl leading-tight">{item.title}</h3>
              <p className="text-cream-50/80 mt-2 text-sm leading-6">{item.detail}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
