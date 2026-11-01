"use client";

import React, { useState } from "react";

import { SectionHeading } from "@/components/marketing/SectionHeading";
import type { PublicHomeData } from "@/server/services/public-content";

type Content = Record<string, unknown>;
type LocationSection = { content: unknown };
type LocationSettings = PublicHomeData["settings"];

function record(value: unknown): Content {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Content) : {};
}

function localized(value: unknown): string {
  const english = record(value).en;
  return typeof english === "string" ? english : "";
}

export function WhereWeAre({
  section,
  settings,
}: {
  section: LocationSection;
  settings: LocationSettings;
}) {
  const [mapLoaded, setMapLoaded] = useState(false);

  if (!settings.address && !settings.phones.length) return null;

  const content = record(section.content);
  const heading = localized(content.heading) || "Find the farm";
  const body = localized(content.body);

  const mapsQuery = settings.address || "Chawan Farms, Baitwadi, Kolad";
  const directionsHref = settings.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(settings.address)}`
    : null;
  const mapsSearchHref = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : null;

  return (
    <section id="find-us" aria-labelledby="find-us-heading" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Farm Address, Phone Numbers, and Action Buttons */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <SectionHeading
              id="find-us-heading"
              eyebrow="// WHERE WE ARE"
              title={heading}
              description={body || undefined}
            />

            <div className="mt-6 flex flex-col gap-4 text-forest-900/80">
              {settings.address && (
                <address className="not-italic text-base sm:text-lg leading-relaxed font-normal text-forest-900/90">
                  {settings.address}
                </address>
              )}

              {settings.phones.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-2">
                  {settings.phones.map((phone) => (
                    <a
                      key={phone}
                      href={`tel:${phone}`}
                      className="text-forest-900 text-sm font-semibold tracking-wide hover:text-laterite-600 transition-colors w-fit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
                    >
                      {phone}
                    </a>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap gap-3">
                {directionsHref && (
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-forest-900 text-cream-50 min-h-11 inline-flex items-center justify-center px-6 rounded-full text-sm font-semibold transition-transform duration-150 hover:-translate-y-0.5 hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
                  >
                    Directions
                  </a>
                )}
                {mapsSearchHref && (
                  <a
                    href={mapsSearchHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-forest-900 text-forest-900 min-h-11 inline-flex items-center justify-center px-6 rounded-full text-sm font-semibold transition-colors duration-150 hover:bg-forest-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Stylized Map Card with Search-bar & Click-to-load embed */}
          <div className="lg:col-span-7">
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-3xl overflow-hidden shadow-xl border border-forest-900/10 bg-[#E8E6DC] flex flex-col">
              {/* Search-bar style header */}
              <div className="absolute top-4 inset-x-4 sm:inset-x-6 z-20 pointer-events-none">
                <div className="w-full bg-white/95 backdrop-blur-sm rounded-full py-2.5 px-5 shadow-sm border border-forest-900/10 text-xs sm:text-sm font-medium text-forest-900/80 truncate">
                  Chawan Farms, {settings.address || "Baitwadi, Kolad"}
                </div>
              </div>

              {/* Map Canvas / Embed */}
              {mapLoaded ? (
                <iframe
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`}
                  title="Google Maps showing location of Chawan Farms"
                  loading="lazy"
                  className="w-full h-full border-0 rounded-3xl"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : (
                <div className="relative w-full h-full">
                  {/* Stylized SVG Map Placeholder Illustration */}
                  <svg
                    viewBox="0 0 600 400"
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  >
                    {/* Background Field Tints */}
                    <rect width="600" height="400" fill="#E8E6DC" />
                    <rect x="0" y="240" width="600" height="160" fill="#DFDCCF" />

                    {/* River Ribbon */}
                    <path
                      d="M 0 320 Q 200 280, 380 310 T 600 260 L 600 300 Q 380 350, 200 320 T 0 360 Z"
                      fill="#C0D5DF"
                      opacity="0.8"
                    />

                    {/* Intersecting Roads */}
                    <line x1="-20" y1="160" x2="620" y2="220" stroke="#FFFFFF" strokeWidth="16" />
                    <line x1="280" y1="-20" x2="400" y2="420" stroke="#FFFFFF" strokeWidth="14" />
                    <line x1="80" y1="-20" x2="480" y2="420" stroke="#FFFFFF" strokeWidth="10" />

                    {/* Farm Land Plot */}
                    <rect
                      x="440"
                      y="280"
                      width="100"
                      height="65"
                      rx="10"
                      fill="#C7D7A3"
                      opacity="0.9"
                    />

                    {/* Farm Location Marker */}
                    <g transform="translate(470, 240)">
                      {/* Terracotta Pin Shape */}
                      <path
                        d="M 0 0 C -18 -25 -25 -45 0 -60 C 25 -45 18 -25 0 0 Z"
                        fill="#B4482A"
                      />
                      <circle cx="0" cy="-42" r="5" fill="#FFFFFF" />

                      {/* Pill Badge */}
                      <rect
                        x="-50"
                        y="-84"
                        width="100"
                        height="22"
                        rx="11"
                        fill="#FFFFFF"
                        filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.15))"
                      />
                      <text
                        x="0"
                        y="-70"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="#12301F"
                      >
                        Chawan Farms
                      </text>
                    </g>
                  </svg>

                  {/* Stylized Zoom Controls Styling (+ / -) */}
                  <div
                    aria-hidden="true"
                    className="absolute bottom-5 right-5 z-10 flex flex-col gap-1.5 pointer-events-none select-none"
                  >
                    <div className="size-8 rounded-lg bg-white shadow-md border border-forest-900/10 flex items-center justify-center text-forest-900 font-bold text-base leading-none">
                      +
                    </div>
                    <div className="size-8 rounded-lg bg-white shadow-md border border-forest-900/10 flex items-center justify-center text-forest-900 font-bold text-base leading-none">
                      −
                    </div>
                  </div>

                  {/* Click-to-load interactive map button / banner */}
                  <div className="absolute inset-0 z-10 flex items-end justify-start p-6 bg-gradient-to-t from-forest-900/20 via-transparent to-transparent">
                    <button
                      type="button"
                      onClick={() => setMapLoaded(true)}
                      className="bg-forest-900 text-cream-50 min-h-11 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold shadow-lg hover:bg-forest-800 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
                    >
                      Load interactive map
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
