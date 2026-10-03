import Image from "next/image";

import { PROTOTYPE_IMAGE } from "@/lib/prototype-data";

type ActivityTileProps = { title: string; label: string; extra?: boolean };

export function ActivityTile({ title, label, extra = false }: ActivityTileProps) {
  return (
    <article className="bg-cream-50 border-forest-900/10 overflow-hidden rounded-2xl border">
      <div className="relative aspect-[4/3]">
        <Image src={PROTOTYPE_IMAGE} alt={`Reserved image frame for ${title}`} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2"><span className="bg-cream-50 text-forest-700 rounded-full px-2.5 py-1 text-[11px] font-semibold">{label}</span>{extra ? <span className="bg-turmeric-500 text-ink-900 rounded-full px-2.5 py-1 text-[11px] font-semibold">Extra cost</span> : null}</div>
      </div>
      <div className="p-4"><h3 className="font-heading text-forest-900 text-xl">{title}</h3><p className="text-mist-500 mt-2 text-xs leading-5">Subject to conditions & availability</p></div>
    </article>
  );
}
