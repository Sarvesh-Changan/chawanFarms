"use client";

import { useState, type ReactNode } from "react";

import { CldImage } from "@/components/media/CldImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type PickerMedia = { id: string; publicId: string; kind: "IMAGE" | "VIDEO"; altText: unknown; format: string | null };

export function MediaPicker({ cloudName, items, onSelect, children }: { cloudName: string; items: PickerMedia[]; onSelect: (item: PickerMedia) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
      <DialogHeader><DialogTitle>Choose media</DialogTitle><DialogDescription>Select an asset from the media library.</DialogDescription></DialogHeader>
      {items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <button type="button" key={item.id} onClick={() => { onSelect(item); setOpen(false); }} className="group overflow-hidden rounded-lg border border-border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <div className="relative aspect-[4/3] bg-muted"><CldImage cloudName={cloudName} publicId={item.publicId} alt="" resourceType={item.kind === "VIDEO" ? "video" : "image"} fill sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition group-hover:scale-105" /></div>
        <span className="block truncate px-2 py-2 text-xs">{item.publicId}</span>
      </button>)}</div> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No media available.</p>}
      <Button type="button" variant="outline" onClick={() => setOpen(false)} className="justify-self-end">Close</Button>
    </DialogContent>
  </Dialog>;
}
