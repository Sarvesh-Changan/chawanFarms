"use client";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";

type MediaOption = { id: string; publicId: string; kind: "IMAGE"; altText: unknown; format: string | null };

export function MediaGalleryField({ value, items, cloudName, disabled, onChange }: {
  value: string[];
  items: MediaOption[];
  cloudName?: string;
  disabled?: boolean;
  onChange: (value: string[]) => void;
}) {
  const selected = value.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });

  return <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4">
    <legend className="px-1 text-sm font-semibold">Gallery images</legend>
    <p className="text-xs text-muted-foreground">Select approved public images. The order selected here is preserved.</p>
    {cloudName && items.length ? <MediaPicker cloudName={cloudName} items={items} onSelect={(item) => {
      if (!value.includes(item.id)) onChange([...value, item.id]);
    }}><Button type="button" variant="outline" disabled={disabled}>Add gallery image</Button></MediaPicker> : <p className="text-xs text-muted-foreground">Approved images can be selected after Media access and Cloudinary are configured.</p>}
    {selected.length ? <ol className="grid gap-2 sm:grid-cols-2">{selected.map((item, index) => <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"><span className="min-w-0 truncate">{index + 1}. {item.publicId}</span><Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(value.filter((id) => id !== item.id))}>Remove</Button></li>)}</ol> : <p className="text-xs text-muted-foreground">No gallery images selected.</p>}
  </fieldset>;
}
