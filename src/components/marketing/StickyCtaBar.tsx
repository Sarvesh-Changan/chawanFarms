"use client";

import { MessageCircle, Phone, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { prototypeBusiness } from "@/lib/prototype-data";

export function StickyCtaBar() {
  const [isFieldFocused, setIsFieldFocused] = useState(false);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      setIsFieldFocused(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement);
    };
    const onFocusOut = () => setIsFieldFocused(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  if (isFieldFocused) return null;

  return (
    <nav aria-label="Quick contact" className="bg-forest-900/95 text-cream-50 fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-cream-50/15 px-2 pt-2 shadow-[0_-8px_30px_rgba(18,48,31,0.18)] backdrop-blur md:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      <a className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500" href={`tel:${prototypeBusiness.phones[0]}`}>
        <Phone aria-hidden="true" className="size-4 text-turmeric-500" />
        Call
      </a>
      <button type="button" disabled aria-describedby="whatsapp-unavailable" className="flex min-h-11 cursor-not-allowed flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold text-cream-50/45">
        <MessageCircle aria-hidden="true" className="size-4" />
        WhatsApp
        <span id="whatsapp-unavailable" className="sr-only">WhatsApp number not supplied in the client source documents.</span>
      </button>
      <Link className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/book">
        <Send aria-hidden="true" className="size-4 text-turmeric-500" />
        Enquire
      </Link>
    </nav>
  );
}
