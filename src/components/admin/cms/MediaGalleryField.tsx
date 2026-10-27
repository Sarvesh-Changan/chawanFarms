"use client";

import { LocalImageUploader } from "@/components/media/LocalImageUploader";

type MediaOption = { id: string; publicId: string; kind: "IMAGE"; altText: unknown; format: string | null; tags?: string[] };

export function MediaGalleryField({ value, items, cloudName, disabled, onChange }: {
  value: string[];
  items: MediaOption[];
  cloudName?: string;
  disabled?: boolean;
  onChange: (value: string[]) => void;
}) {
  const slots = [...value, ...(value.length < 8 ? [""] : [])];
  return <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4">
    <legend className="px-1 text-sm font-semibold">Gallery images</legend>
    <p className="text-xs text-muted-foreground">Upload up to eight local images. The order shown here is preserved.</p>
    <div className="grid gap-4 md:grid-cols-2">{slots.map((id, index) => <LocalImageUploader key={`${index}-${id}`} label={`Gallery image ${index + 1}`} value={id} media={items.find((item) => item.id === id)} cloudName={cloudName} disabled={disabled} onChange={(mediaId) => onChange(id ? value.map((current, currentIndex) => currentIndex === index ? mediaId : current) : [...value, mediaId])} onRemove={() => onChange(value.filter((_, currentIndex) => currentIndex !== index))} />)}</div>
  </fieldset>;
}
