"use client";

import { LocalImageUploader } from "@/components/media/LocalImageUploader";

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
  return <LocalImageUploader label={label} value={value} media={selected} cloudName={cloudName} disabled={disabled} onChange={onChange} onRemove={() => onChange("")} helperText="Choose an existing approved image or upload a verified local file. The upload is attached when you save this form." />;
}
