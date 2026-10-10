"use client";

import { AlertTriangle, Home, MessageSquare, Phone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-cream-50/60 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        {/* Warning Badge */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-laterite-600/10 text-laterite-600 sm:h-24 sm:w-24">
          <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12" />
        </div>

        <span className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.25em] text-laterite-600">
          Temporary Roadblock
        </span>

        <h1 className="mt-2 font-heading text-3xl text-forest-900 sm:text-4xl md:text-5xl">
          Something Went Off-Trail
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          We encountered an unexpected issue while loading this page. Our system
          has recorded the error. You can try refreshing or returning to our
          main page.
        </p>

        {error.digest ? (
          <p className="mt-2 text-xs font-mono text-muted-foreground/80">
            Error ID: {error.digest}
          </p>
        ) : null}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
          >
            <Home className="h-4 w-4" /> Return to Home
          </Link>
        </div>

        {/* Prominent Contact CTA */}
        <div className="mt-12 rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
          <h2 className="font-heading text-xl text-forest-900">
            Need urgent help or planning a stay?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team is available by phone or email to answer any inquiries.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-laterite-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-laterite-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-laterite-600"
            >
              <MessageSquare className="h-4 w-4" /> Contact Us
            </Link>
            <a
              href="tel:9821502956"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              <Phone className="h-4 w-4" /> Call 9821502956
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
