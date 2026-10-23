"use client";

import { useEffect } from "react";

export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-cream-50 px-6"><section className="rounded-2xl border border-destructive/30 bg-card p-8 text-center"><h1 className="font-heading text-2xl text-forest-900">Something went wrong</h1><p className="mt-2 text-sm text-muted-foreground">We couldn’t load your account.</p><button type="button" onClick={reset} className="mt-5 min-h-11 rounded-lg bg-forest-700 px-4 text-sm font-medium text-cream-50">Try again</button></section></main>;
}
