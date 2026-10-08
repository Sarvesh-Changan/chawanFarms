import Link from "next/link";

import { Button } from "@/components/ui/button";

export function NoAccess({ title = "No access to this section", message = "Your current staff access does not include this page." }: { title?: string; message?: string }) {
  return <section className="mx-auto grid min-h-72 max-w-xl content-center justify-items-start gap-3 rounded-2xl border border-border/70 bg-card p-6 sm:p-10"><p className="text-xs font-semibold tracking-[0.16em] text-laterite-600 uppercase">Access control</p><h1 className="font-heading text-3xl text-forest-900">{title}</h1><p className="text-sm text-muted-foreground">{message}</p><Button asChild variant="outline"><Link href="/">Visit site</Link></Button></section>;
}
