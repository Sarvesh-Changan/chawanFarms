"use client";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";

type MediaOption = { id: string; publicId: string; kind: "IMAGE"; altText: unknown; format: string | null };

export function MediaReferenceField({ label, value, items, cloudName, onChange, disabled }: {
  label: string;
  value: string;
  items: MediaOption[];
  cloudName?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const selected = items.find((item) => item.id === value);
  return <div className="grid gap-2">
    <span className="text-xs font-medium">{label}</span>
    {cloudName && items.length ? <MediaPicker cloudName={cloudName} items={items} onSelect={(item) => onChange(item.id)}>
      <Button type="button" variant="outline" disabled={disabled}>{selected ? `Selected: ${selected.publicId}` : "Choose approved image"}</Button>
    </MediaPicker> : <p className="text-xs text-muted-foreground">Approved images can be selected after Media access and Cloudinary are configured.</p>}
    {value ? <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={disabled} onClick={() => onChange("")}>Remove image selection</Button> : null}
  </div>;
}
