import Link from "next/link";

import { prototypeBusiness } from "@/lib/prototype-data";

export function Footer() {
  return (
    <footer className="bg-forest-900 text-cream-50 px-4 py-12 pb-28 sm:px-8 lg:px-12 lg:pb-12">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <p className="font-heading text-3xl">Chawan Farms</p>
          <p className="text-cream-50/70 mt-3 max-w-sm text-sm leading-6">Come live, experience & rediscover yourself & nature at its best.</p>
        </div>
        <div>
          <p className="text-turmeric-500 text-xs font-semibold tracking-[0.18em] uppercase">Explore</p>
          <div className="mt-3 grid gap-2 text-sm text-cream-50/80">
            <Link className="w-fit hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/#experiences">Experiences</Link>
            <Link className="w-fit hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/packages">Packages</Link>
            <Link className="w-fit hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/book">Book / Enquire</Link>
          </div>
        </div>
        <div>
          <p className="text-turmeric-500 text-xs font-semibold tracking-[0.18em] uppercase">Find us</p>
          <address className="text-cream-50/80 mt-3 text-sm leading-6 not-italic">{prototypeBusiness.address}</address>
          <div className="mt-2 grid gap-1 text-sm">
            {prototypeBusiness.phones.map((phone) => <a className="w-fit text-cream-50/80 hover:text-turmeric-500 focus-visible:outline-2 focus-visible:outline-turmeric-500" href={`tel:${phone}`} key={phone}>{phone}</a>)}
          </div>
          <p className="text-cream-50/50 mt-3 text-xs">WhatsApp and email details will be added after client confirmation.</p>
        </div>
      </div>
      <div className="border-cream-50/15 text-cream-50/50 mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t pt-5 text-xs sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Chawan Farms</span>
        <span>Prototype content · client review pending</span>
      </div>
    </footer>
  );
}
