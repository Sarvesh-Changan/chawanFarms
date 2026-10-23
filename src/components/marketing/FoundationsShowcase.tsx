"use client";

import { FilterTabs } from "@/components/marketing/FilterTabs";
import { ImageCard } from "@/components/marketing/ImageCard";
import { MetaRow } from "@/components/marketing/MetaRow";
import { NumberedMarker } from "@/components/marketing/NumberedMarker";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { StatStrip } from "@/components/marketing/StatStrip";
import { TagChip } from "@/components/marketing/TagChip";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { Reveal } from "@/components/motion/Reveal";

const SAMPLE_FILTERS = [
  { id: "sample-one", label: "Sample one" },
  { id: "sample-two", label: "Sample two" },
  { id: "sample-three", label: "Sample three" },
] as const;

export function FoundationsShowcase() {
  return (
    <main className="min-h-screen bg-cream-50 px-5 py-12 text-ink-900 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-20">
        <header className="max-w-4xl space-y-5">
          <SectionEyebrow>Sample only · design foundation</SectionEyebrow>
          <h1 className="font-heading text-forest-900 text-[var(--type-display-xl)] leading-[var(--leading-display)] tracking-tight">
            Marketing foundations
          </h1>
          <p className="max-w-2xl text-mist-500 text-[var(--type-body)] leading-[var(--leading-body)]">
            Development-only samples for the shared marketing components and
            motion rules. All copy and values on this page are sample content.
          </p>
        </header>

        <section aria-labelledby="headings-and-markers" className="space-y-8">
          <SectionHeading
            id="headings-and-markers"
            eyebrow="Sample component"
            title="Section headings and editorial markers"
            description="The heading system combines the shared eyebrow, fluid display scale, and optional supporting content."
          />
          <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-panel)] bg-clay-100 p-6">
            <NumberedMarker value={1} />
            <NumberedMarker value={2} />
            <TagChip>Sample tag</TagChip>
            <MetaRow items={["Sample metadata", "Sample detail"]} />
          </div>
        </section>

        <section aria-labelledby="filters" className="space-y-8">
          <SectionHeading
            id="filters"
            eyebrow="Sample component"
            title="Filter tabs"
            description="Use the arrow keys, Home, and End to move through the roving tab stops."
          />
          <FilterTabs items={SAMPLE_FILTERS} ariaLabel="Sample filters" />
        </section>

        <section aria-labelledby="stats" className="space-y-8">
          <SectionHeading
            id="stats"
            eyebrow="Sample component"
            title="Stat items and strips"
            description="Values below are intentionally labeled as sample values and do not describe a real property or service."
          />
          <StatStrip
            items={[
              { label: "Sample label", value: "Sample value" },
              { label: "Another sample", value: "Sample value" },
            ]}
          />
          <div className="rounded-[var(--radius-panel)] border border-forest-900/10 p-6 text-mist-500">
            An empty StatStrip renders no output; this note is sample showcase
            context only.
          </div>
        </section>

        <section aria-labelledby="cards-and-motion" className="space-y-8">
          <SectionHeading
            id="cards-and-motion"
            eyebrow="Sample component"
            title="Image cards and motion"
            description="Hover and focus use transform-only image zoom; reveal and parallax respect reduced-motion preferences."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <ImageCard
              src="/placeholder-farm.svg"
              alt="Sample placeholder image"
              eyebrow="Sample card"
              title="Sample image card"
              description="Sample copy only."
              meta={["Sample metadata"]}
            />
            <Reveal>
              <ParallaxImage
                src="/placeholder-farm.svg"
                alt="Sample placeholder image for motion testing"
                className="min-h-72 rounded-[var(--radius-card)]"
              />
            </Reveal>
          </div>
        </section>
      </div>
    </main>
  );
}
