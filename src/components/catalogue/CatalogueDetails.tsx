import { CldImage } from "@/components/media/CldImage";
import { env } from "@/config/env";
import type { PublicMedia } from "@/server/services/public-content";

export function localized(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

export function DetailHero({ eyebrow, title, summary, media }: { eyebrow: string; title: string; summary?: string; media: PublicMedia | null }) {
  return <section className="bg-forest-900 text-cream-50"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-12 lg:py-20"><div><p className="text-paddy-300 text-xs font-semibold tracking-[0.2em] uppercase">{eyebrow}</p><h1 className="font-heading mt-4 text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">{title}</h1>{summary ? <p className="text-cream-50/80 mt-6 max-w-2xl text-lg leading-8">{summary}</p> : null}</div><div className="bg-clay-100 relative aspect-[4/3] overflow-hidden rounded-2xl">{media && env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? <CldImage cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME} publicId={media.publicId} resourceType={media.kind === "VIDEO" ? "video" : "image"} alt={localized(media.altText)} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover"/> : null}</div></div></section>;
}

export function DetailBody({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-12">{children}</main>;
}

export function DetailPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-cream-50 border-forest-900/10 rounded-2xl border p-5 shadow-sm sm:p-7"><h2 className="font-heading text-forest-900 text-2xl">{title}</h2><div className="text-mist-500 mt-4 space-y-3 text-sm leading-7">{children}</div></section>;
}

export function MediaGallery({ media, label }: { media: PublicMedia[]; label: string }) {
  if (!media.length || !env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) return null;
  return <section aria-label={`${label} images`} className="grid grid-cols-2 gap-3">{media.map((item) => <div key={item.id} className="bg-clay-100 relative aspect-[4/3] overflow-hidden rounded-xl"><CldImage cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} publicId={item.publicId} resourceType={item.kind === "VIDEO" ? "video" : "image"} alt={localized(item.altText)} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover"/></div>)}</section>;
}

export function EmptyCatalogue({ label }: { label: string }) {
  return <div className="mx-auto min-h-[20rem] max-w-5xl py-20"><h2 className="font-heading text-4xl">{label}</h2><p className="text-mist-500 mt-4">This content is not available.</p></div>;
}
