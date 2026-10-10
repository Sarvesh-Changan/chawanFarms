"use client";

import { Button } from "@/components/ui/button";

export default function LeadsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
    <h1 className="font-heading text-2xl text-forest-900">The lead workspace could not load</h1>
    <p className="mt-2 text-sm text-muted-foreground">Please retry. If the problem continues, contact an administrator.</p>
    <Button className="mt-4" onClick={() => reset()}>Try again</Button>
  </section>;
}
