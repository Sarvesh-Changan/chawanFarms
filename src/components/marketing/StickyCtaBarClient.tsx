"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CallButton, WhatsAppButton } from "@/components/marketing/ContactButtons";

export function StickyCtaBarClient({ phone, whatsappNumber, whatsappMessage }: { phone?: string; whatsappNumber?: string; whatsappMessage?: string }) {
  const [isFieldFocused, setIsFieldFocused] = useState(false);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      setIsFieldFocused(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement);
    };
    const onFocusOut = () => setIsFieldFocused(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusin", onFocusIn); document.removeEventListener("focusout", onFocusOut); };
  }, []);
  if (isFieldFocused) return null;
  const itemCount = Number(Boolean(phone)) + Number(Boolean(whatsappNumber)) + 1;
  const columns = itemCount === 1 ? "grid-cols-1" : itemCount === 2 ? "grid-cols-2" : "grid-cols-3";
  return <nav aria-label="Quick contact" className={`fixed inset-x-0 bottom-0 z-50 grid ${columns} border-t border-cream-50/15 bg-forest-900/95 px-2 pt-2 text-cream-50 shadow-[0_-8px_30px_rgba(18,48,31,0.18)] backdrop-blur md:hidden`} style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
    {phone ? <CallButton number={phone} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500">Call</CallButton> : null}
    {whatsappNumber ? <WhatsAppButton number={whatsappNumber} message={whatsappMessage} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500">WhatsApp</WhatsAppButton> : null}
    <Link className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-turmeric-500" href="/book"><Send aria-hidden="true" className="size-4 text-turmeric-500"/>Enquire</Link>
  </nav>;
}
