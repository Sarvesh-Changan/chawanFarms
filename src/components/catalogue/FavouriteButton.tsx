"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { toggleFavouriteAction } from "@/server/actions/favourites";

type FavouriteEntity = "package" | "experience" | "activity";

export function FavouriteButton({ entityType, entityId, label, initialSaved = false }: { entityType: FavouriteEntity; entityId: string; label: string; initialSaved?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    setMessage("");
    startTransition(async () => {
      const result = await toggleFavouriteAction({ entityType, entityId });
      if (result.ok) setSaved(result.data.saved);
      else if (result.error.code === "UNAUTHENTICATED") setMessage(result.error.message);
      else setMessage(result.error.message);
    });
  }

  return <div className="relative">
    <button type="button" aria-pressed={saved} aria-label={saved ? `Remove ${label} from favourites` : `Save ${label} to favourites`} title={saved ? "Remove from favourites" : "Save to favourites"} disabled={pending} onClick={toggle} className="bg-cream-50/95 text-forest-900 grid size-11 place-items-center rounded-full shadow-sm transition hover:bg-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 disabled:opacity-60">
      <Heart aria-hidden="true" className={`size-5 ${saved ? "fill-laterite-600 text-laterite-600" : ""}`} />
    </button>
    {message ? <div role="status" className="bg-cream-50 text-forest-900 absolute top-12 right-0 z-10 w-56 rounded-lg p-3 text-xs shadow-lg"><p>{message}</p><Link href="/signup" className="text-forest-700 mt-2 inline-flex min-h-9 items-center font-semibold underline underline-offset-4">Create an account</Link></div> : null}
  </div>;
}
