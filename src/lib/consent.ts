import { z } from "zod";

const consentSchema = z.object({
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
}).strict();

export type Consent = { analytics: boolean; marketing: boolean };

export function parseConsentCookie(raw: unknown): Consent {
  if (typeof raw !== "string" || raw.length > 512) return { analytics: false, marketing: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = consentSchema.safeParse(parsed);
    return result.success ? result.data : { analytics: false, marketing: false };
  } catch {
    return { analytics: false, marketing: false };
  }
}

export function getConsent(): Consent {
  if (typeof document === "undefined") return { analytics: false, marketing: false };
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("cf_consent="));
  if (!cookie) return { analytics: false, marketing: false };
  try { return parseConsentCookie(decodeURIComponent(cookie.slice("cf_consent=".length))); }
  catch { return { analytics: false, marketing: false }; }
}

export function hasTrackingConsent(consent: Consent): boolean {
  return consent.analytics || consent.marketing;
}
