import { ExternalLink, MapPin } from "lucide-react";

import { prototypeBusiness } from "@/lib/prototype-data";

export function LocationBlock() {
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prototypeBusiness.address)}`;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
      <div className="bg-forest-900 text-cream-50 relative min-h-72 overflow-hidden rounded-[1.5rem] p-6 sm:min-h-96 sm:p-8">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(135deg, transparent 48%, var(--paddy-300) 49%, transparent 50%), linear-gradient(45deg, transparent 48%, var(--leaf-500) 49%, transparent 50%)", backgroundSize: "72px 72px" }} />
        <div className="relative flex h-full min-h-60 flex-col justify-between"><span className="bg-turmeric-500 text-forest-900 grid size-12 place-items-center rounded-full"><MapPin aria-hidden="true" /></span><p className="max-w-sm text-sm leading-6 text-cream-50/75">A styled map placeholder keeps the prototype privacy-friendly. Exact coordinates and travel notes are not yet supplied.</p></div>
      </div>
      <div><p className="text-laterite-600 text-xs font-semibold tracking-[0.2em] uppercase">Come find us</p><h3 className="font-heading text-forest-900 mt-3 text-4xl leading-tight">A farm day in Baitwadi, Kolad.</h3><address className="text-mist-500 mt-5 max-w-sm text-base leading-7 not-italic">{prototypeBusiness.address}</address><a href={mapHref} target="_blank" rel="noreferrer" className="bg-forest-700 text-cream-50 mt-7 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-semibold hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Open in Google Maps <ExternalLink aria-hidden="true" className="size-4" /></a><p className="text-mist-500 mt-4 text-xs leading-5">Travel notes and distances will be added after the client supplies and approves them.</p></div>
    </div>
  );
}
