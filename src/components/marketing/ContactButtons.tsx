"use client";

import { MessageCircle, Phone } from "lucide-react";

export function CallButton({ number, className, children }: { number?: string; className?: string; children?: React.ReactNode }) {
  if (!number) return <span className={className} aria-disabled="true">{children ?? "Call details unavailable"}</span>;
  return <a className={className} href={`tel:${number}`} onClick={() => sendClick("CALL_CLICK")}><Phone aria-hidden="true" className="size-4"/>{children ?? number}</a>;
}

export function WhatsAppButton({ number, message, className, children }: { number?: string; message?: string; className?: string; children?: React.ReactNode }) {
  if (!number) return <span className={className} aria-disabled="true">{children ?? "WhatsApp details unavailable"}</span>;
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return <a className={className} href={`https://wa.me/${number.replaceAll("+", "")}${text}`} target="_blank" rel="noopener noreferrer" onClick={() => sendClick("WHATSAPP_CLICK")}><MessageCircle aria-hidden="true" className="size-4"/>{children ?? "WhatsApp"}</a>;
}

function sendClick(type: "WHATSAPP_CLICK" | "CALL_CLICK") {
  if (typeof navigator === "undefined" || typeof window === "undefined") return;
  const body = JSON.stringify({ type, path: window.location.pathname, anonymousId: crypto.randomUUID() });
  try { navigator.sendBeacon("/api/lead-events", new Blob([body], { type: "application/json" })); } catch { /* The contact link still works if beacon support is unavailable. */ }
}
