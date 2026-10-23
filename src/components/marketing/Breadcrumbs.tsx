import Link from "next/link";

import { cn } from "@/lib/utils";

export function Breadcrumbs({ items, className }: { items: Array<{ label: string; href?: string }>; className?: string }) {
  return <nav aria-label="Breadcrumb" className={cn("mx-auto max-w-7xl px-4 pt-6 sm:px-8 lg:px-12", className)}>
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      <li><Link href="/" className="hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-turmeric-500">Home</Link></li>
      {items.map((item) => <li key={`${item.href ?? "current"}-${item.label}`} className="flex items-center gap-2"><span aria-hidden="true">/</span>{item.href ? <Link href={item.href} className="hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-turmeric-500">{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}
    </ol>
  </nav>;
}
