import { Compass, Home, MapPin, MessageSquare, Phone } from "lucide-react";
import Link from "next/link";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex min-h-[75vh] items-center justify-center bg-cream-50/60 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          {/* Compass / Trail Motif */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-forest-900/10 text-forest-900 sm:h-24 sm:w-24">
            <Compass className="h-10 w-10 text-laterite-600 sm:h-12 sm:w-12" />
          </div>

          <span className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.25em] text-laterite-600">
            404 · Unfamiliar Trail
          </span>

          <h1 className="mt-2 font-heading text-4xl text-forest-900 sm:text-5xl md:text-6xl">
            You&apos;ve Wandered Off-Trail
          </h1>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            The page you are looking for does not exist or has been relocated.
            Let&apos;s guide you back to familiar paths across Chawan Farms.
          </p>

          {/* Quick Shortcuts */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              <Home className="h-4 w-4" /> Return to Home
            </Link>
            <Link
              href="/packages"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              <MapPin className="h-4 w-4" /> Explore Packages
            </Link>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              Photo Gallery
            </Link>
          </div>

          {/* Prominent Contact CTA */}
          <div className="mt-12 rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
            <h2 className="font-heading text-xl text-forest-900">
              Need assistance finding what you need?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Our farm team in Kolad is happy to assist with questions and booking
              inquiries.
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
      <Footer />
    </>
  );
}
