import Link from "next/link";

export function Header() {
  return (
    <header className="bg-cream-50/95 text-forest-900 sticky top-0 z-40 border-b border-forest-900/10 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="group flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric-500">
          <span className="bg-forest-700 text-turmeric-500 grid size-10 place-items-center rounded-full font-heading text-xl">C</span>
          <span className="leading-tight">
            <span className="block font-heading text-lg">Chawan Farms</span>
            <span className="text-mist-500 block text-[10px] font-semibold tracking-[0.17em] uppercase">Agri-Tourism Centre</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="hidden items-center gap-6 text-sm font-medium lg:flex">
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/#experiences">Experiences</Link>
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/packages">Packages</Link>
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/#gallery">Gallery</Link>
          <Link className="rounded-md px-2 py-3 hover:text-laterite-600 focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/#location">Find us</Link>
        </nav>
        <Link href="/book" className="bg-turmeric-500 text-ink-900 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">
          Book / Enquire
        </Link>
      </div>
    </header>
  );
}
