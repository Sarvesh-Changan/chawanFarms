import Link from "next/link";

import { SafeHtml } from "@/components/admin/SafeHtml";
import { CldImage } from "@/components/media/CldImage";
import type { CmsContentType } from "@/config/cms-content";
import { getPublicCmsContent } from "@/server/services/cms/content";

export async function PublicContentList({ type, slug }: { type: CmsContentType; slug?: string }) {
  const records = await getPublicCmsContent(type) as Array<Record<string, unknown>>;
  const selected = slug ? records.find((item) => item.slug === slug) : undefined;
  if (slug && !selected) return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="font-heading text-4xl">This content is not available.</h1></main>;
  const items = selected ? [selected] : records;
  return <main className="mx-auto max-w-5xl space-y-8 px-5 py-12"><h1 className="font-heading text-4xl capitalize">{type.replaceAll("-", " ")}</h1>{items.length ? <div className="grid gap-6 md:grid-cols-2">{items.map((item) => {
    const titleValue = item.title ?? item.name ?? item.question ?? item.quote;
    const title = localized(titleValue) || String(item.authorName ?? "");
    const body = item.body ?? item.description ?? item.answer;
    const href = typeof item.slug === "string" ? `/${type === "post" ? "stories" : type === "activity" ? "activities" : "experiences"}/${item.slug}` : undefined;
    const media = item.media && typeof item.media === "object" ? item.media as Record<string, unknown> : null;
    const caption = localized(item.caption) || localized(media?.altText);
    return <article className="space-y-3 rounded-2xl border border-border/70 bg-card p-6" key={String(item.id)}>{media && typeof media.publicId === "string" ? <CldImage cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""} publicId={media.publicId} alt={caption} resourceType={media.kind === "VIDEO" ? "video" : "image"} width={1200} height={800} className="h-auto w-full rounded-lg object-cover" /> : null}<h2 className="font-heading text-2xl">{href && !slug ? <Link href={href}>{title}</Link> : title}</h2>{item.summary ? <p className="text-muted-foreground">{localized(item.summary)}</p> : null}{body ? <SafeHtml html={localized(body)} /> : null}{item.category ? <p className="text-sm text-muted-foreground">{String(item.category)}</p> : null}</article>;
  })}</div> : <p className="rounded-xl border border-dashed p-8 text-muted-foreground">No published content is available yet.</p>}</main>;
}

function localized(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "en" in value) return String((value as { en?: unknown }).en ?? "");
  return "";
}
