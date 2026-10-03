import Link from "next/link";

export function FinalCta() {
  return (
    <section className="bg-laterite-600 text-cream-50 px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between"><div className="max-w-2xl"><p className="text-paddy-300 text-xs font-semibold tracking-[0.2em] uppercase">Make some space</p><h2 className="font-heading mt-3 text-[clamp(2.5rem,7vw,5rem)] leading-[1]">Come for the farm. Leave with a slower clock.</h2></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/book" className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Plan your stay</Link><Link href="/packages" className="border-cream-50/50 text-cream-50 inline-flex min-h-12 items-center justify-center rounded-lg border px-5 font-semibold hover:bg-cream-50/10 focus-visible:outline-2 focus-visible:outline-turmeric-500">See packages</Link></div></div>
    </section>
  );
}
