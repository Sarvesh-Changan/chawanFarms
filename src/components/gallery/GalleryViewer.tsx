"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Film,
  Maximize2,
  Play,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CldImage } from "@/components/media/CldImage";
import type { PublicMedia } from "@/server/services/public-content";

export type GalleryViewerItem = {
  id: string;
  category: string;
  caption: unknown;
  sortOrder: number;
  isFeatured: boolean;
  media: PublicMedia;
};

export interface GalleryViewerProps {
  items: GalleryViewerItem[];
  cloudName?: string;
}

function localizedString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "en" in value) {
    const val = (value as { en?: unknown }).en;
    return typeof val === "string" ? val : "";
  }
  return "";
}

export function GalleryViewer({ items, cloudName: propCloudName }: GalleryViewerProps) {
  const searchParams = useSearchParams();
  const urlItem = searchParams?.get("item") ?? null;

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Derive active item id without triggering cascading setState in an effect
  const activeItemId = selectedItemId ?? (urlItem && items.some((i) => i.id === urlItem) ? urlItem : null);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const item of items) {
      if (item.category?.trim()) unique.add(item.category.trim());
    }
    return ["All", ...Array.from(unique).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") return items;
    return items.filter(
      (item) => item.category.toLowerCase() === selectedCategory.toLowerCase(),
    );
  }, [items, selectedCategory]);

  const activeIndex = useMemo(() => {
    if (!activeItemId) return -1;
    return filteredItems.findIndex((item) => item.id === activeItemId);
  }, [activeItemId, filteredItems]);

  const activeItem = activeIndex >= 0 ? filteredItems.at(activeIndex) ?? null : null;

  const updateUrlParam = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set("item", id);
    } else {
      url.searchParams.delete("item");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  const openLightbox = useCallback(
    (id: string) => {
      setSelectedItemId(id);
      updateUrlParam(id);
    },
    [updateUrlParam],
  );

  const closeLightbox = useCallback(() => {
    const prevId = activeItemId;
    setSelectedItemId(null);
    updateUrlParam(null);
    if (prevId) {
      const el = triggerRefs.current.get(prevId);
      el?.focus();
    }
  }, [activeItemId, updateUrlParam]);

  const goToNext = useCallback(() => {
    if (filteredItems.length === 0) return;
    const nextIdx = (activeIndex + 1) % filteredItems.length;
    const nextItem = filteredItems.at(nextIdx);
    if (nextItem) {
      setSelectedItemId(nextItem.id);
      updateUrlParam(nextItem.id);
    }
  }, [activeIndex, filteredItems, updateUrlParam]);

  const goToPrev = useCallback(() => {
    if (filteredItems.length === 0) return;
    const prevIdx = (activeIndex - 1 + filteredItems.length) % filteredItems.length;
    const prevItem = filteredItems.at(prevIdx);
    if (prevItem) {
      setSelectedItemId(prevItem.id);
      updateUrlParam(prevItem.id);
    }
  }, [activeIndex, filteredItems, updateUrlParam]);

  // Keyboard navigation
  useEffect(() => {
    if (!activeItem) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItem, closeLightbox, goToNext, goToPrev]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (activeItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeItem]);

  const handleCopyLink = useCallback(async () => {
    if (!activeItem || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("item", activeItem.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  }, [activeItem]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const cloudName = propCloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

  return (
    <div className="w-full">
      {/* Category Filter Chips */}
      {categories.length > 1 && (
        <div
          role="toolbar"
          aria-label="Filter gallery by category"
          className="mb-10 flex flex-wrap items-center justify-center gap-2"
        >
          {categories.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={isActive}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 ${
                  isActive
                    ? "bg-forest-900 text-cream-50 shadow-sm"
                    : "border border-border/80 bg-background/80 text-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Masonry Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <p className="font-heading text-xl text-forest-900">
            No items in this category
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try choosing another category or check back soon.
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3 xl:columns-4">
          {filteredItems.map((item) => {
            const caption =
              localizedString(item.caption) ||
              localizedString(item.media.caption) ||
              localizedString(item.media.altText) ||
              "Chawan Farms gallery photograph";
            const isVideo = item.media.kind === "VIDEO";
            const width = item.media.width ?? 1200;
            const height = item.media.height ?? 800;
            const aspectRatio = width / height;

            return (
              <div
                key={item.id}
                className="group relative break-inside-avoid overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:shadow-md"
              >
                <button
                  type="button"
                  ref={(el) => {
                    if (el) triggerRefs.current.set(item.id, el);
                    else triggerRefs.current.delete(item.id);
                  }}
                  onClick={() => openLightbox(item.id)}
                  aria-label={`View ${isVideo ? "video" : "image"}: ${caption}`}
                  className="relative block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 focus-visible:ring-offset-2"
                >
                  <div
                    className="relative w-full overflow-hidden bg-muted/40"
                    style={{ aspectRatio: `${Math.max(0.6, Math.min(1.8, aspectRatio))}` }}
                  >
                    <CldImage
                      cloudName={cloudName}
                      publicId={item.media.publicId}
                      alt={caption}
                      resourceType={isVideo ? "video" : "image"}
                      width={width}
                      height={height}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />

                    {/* Overlay Gradient on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Video Badge */}
                    {isVideo && (
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Video</span>
                        {item.media.durationSec ? (
                          <span className="text-white/80">
                            · {Math.round(item.media.durationSec)}s
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Expand icon on hover */}
                    <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                      <Maximize2 className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Caption & Category Footer */}
                  <div className="p-4">
                    <span className="inline-block rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-secondary-foreground">
                      {item.category}
                    </span>
                    {caption && (
                      <p className="mt-2 line-clamp-2 text-sm text-foreground/90">
                        {caption}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessible Lightbox Modal */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gallery media lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-3 sm:p-6 backdrop-blur-md"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Controls Bar */}
          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-4 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wider text-white/90">
                {activeItem.category}
              </span>
              <span className="text-xs text-white/70">
                {activeIndex + 1} of {filteredItems.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy direct link to this media"
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric-500"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-leaf-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Share Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={closeLightbox}
                aria-label="Close lightbox"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Previous Button */}
          {filteredItems.length > 1 && (
            <button
              type="button"
              onClick={goToPrev}
              aria-label="Previous item"
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric-500 sm:left-6"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Media Viewport */}
          <div className="relative flex max-h-[80vh] max-w-[90vw] flex-col items-center justify-center">
            {activeItem.media.kind === "VIDEO" ? (
              <div className="relative flex flex-col items-center">
                <video
                  controls
                  autoPlay
                  playsInline
                  src={`https://res.cloudinary.com/${encodeURIComponent(
                    cloudName,
                  )}/video/upload/q_auto,f_auto/${encodeURI(activeItem.media.publicId)}`}
                  className="max-h-[70vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
                />
              </div>
            ) : (
              <div className="relative flex flex-col items-center">
                <CldImage
                  cloudName={cloudName}
                  publicId={activeItem.media.publicId}
                  alt={
                    localizedString(activeItem.caption) ||
                    localizedString(activeItem.media.caption) ||
                    localizedString(activeItem.media.altText) ||
                    "Chawan Farms gallery photograph"
                  }
                  resourceType="image"
                  width={activeItem.media.width ?? 1600}
                  height={activeItem.media.height ?? 1000}
                  className="max-h-[72vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
                  sizes="90vw"
                  priority
                />
              </div>
            )}

            {/* Caption & Info */}
            <div className="mt-4 max-w-2xl px-4 text-center">
              <p className="text-sm font-medium text-white/95 sm:text-base">
                {localizedString(activeItem.caption) ||
                  localizedString(activeItem.media.caption) ||
                  localizedString(activeItem.media.altText)}
              </p>
              {activeItem.media.kind === "VIDEO" && (
                <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-white/70">
                  <Film className="h-3 w-3" />
                  <span>Video recorded at Chawan Farms</span>
                </p>
              )}
            </div>
          </div>

          {/* Next Button */}
          {filteredItems.length > 1 && (
            <button
              type="button"
              onClick={goToNext}
              aria-label="Next item"
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric-500 sm:right-6"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Backdrop click to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={closeLightbox}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
