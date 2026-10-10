import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { getPolicyVersionsForPublic } from "@/server/services/cms/policies";

interface PublishedPolicyDocumentProps {
  keys: string[];
  title: string;
  emptyMessage: string;
}

export async function PublishedPolicyDocument({
  keys,
  title,
  emptyMessage,
}: PublishedPolicyDocumentProps) {
  const versions = await getPolicyVersionsForPublic(keys);
  const latest = new Map<string, (typeof versions)[number]>();
  for (const version of versions) {
    if (!latest.has(version.key)) {
      latest.set(version.key, version);
    }
  }
  const documents = Array.from(latest.values());

  return (
    <>
      <Header />
      <main className="min-h-screen bg-cream-50/60 pb-20 pt-8 sm:pt-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb / Back Navigation */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 transition hover:text-laterite-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </div>

          {/* Page Header */}
          <header className="mb-12 border-b border-border/80 pb-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-laterite-600">
              <Shield className="h-4 w-4" />
              <span>Chawan Farms Legal &amp; Policies</span>
            </div>
            <h1 className="mt-2 font-heading text-4xl text-forest-900 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Please review these guidelines and terms applicable to visits,
              bookings, stays, and privacy at Chawan Farms.
            </p>
          </header>

          {/* Documents Content */}
          {documents.length ? (
            <div className="space-y-12">
              {documents.map((doc) => {
                const body =
                  doc.body &&
                  typeof doc.body === "object" &&
                  !Array.isArray(doc.body)
                    ? (doc.body as Record<string, unknown>).en
                    : "";

                return (
                  <article
                    key={doc.id}
                    className="rounded-3xl border border-border/70 bg-card p-8 shadow-sm sm:p-12"
                  >
                    <h2 className="font-heading text-2xl text-forest-900 sm:text-3xl">
                      {doc.title}
                    </h2>
                    {doc.version ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Version {doc.version}
                        {doc.publishedAt ? ` · Published ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(doc.publishedAt))}` : " · Configured policy"}
                      </p>
                    ) : null}

                    <div className="prose prose-forest mt-6 max-w-none text-foreground/90 leading-relaxed">
                      {typeof body === "string" && body.trim() ? (
                        <SafeHtml html={body} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No policy text specified.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card p-12 text-center shadow-sm">
              <p className="font-heading text-xl text-forest-900">
                Notice on Policy Updates
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
              <div className="mt-6">
                <Link
                  href="/contact"
                  className="rounded-full bg-forest-900 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-forest-700"
                >
                  Contact Farm Management
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
