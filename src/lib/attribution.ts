import { z } from "zod";

import { ATTRIBUTION_COOKIE } from "@/config/leads";
import { getConsent, hasTrackingConsent } from "@/lib/consent";

const utmValue = z.string().trim().max(200).optional().transform((value) => value || undefined);
const pathSchema = z.string().trim().min(1).max(500)
  .refine((value) => value.startsWith("/") && !value.startsWith("//") && !/[?#\r\n]/.test(value));
const referrerSchema = z.string().trim().max(2048).optional().transform((value) => value || undefined)
  .pipe(z.string().url().refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }).optional());

export const touchSchema = z.object({
  utmSource: utmValue,
  utmMedium: utmValue,
  utmCampaign: utmValue,
  utmTerm: utmValue,
  utmContent: utmValue,
  referrer: referrerSchema,
  landingPath: pathSchema,
}).strict();

export const attributionSchema = z.object({
  firstTouch: touchSchema.optional(),
  lastTouch: touchSchema.optional(),
}).strict();

export type AttributionTouch = z.input<typeof touchSchema>;
export type Attribution = z.input<typeof attributionSchema>;

function currentTouch(path: string, params?: URLSearchParams, referrer?: string): AttributionTouch {
  return touchSchema.parse({
    landingPath: path,
    utmSource: params?.get("utm_source") ?? undefined,
    utmMedium: params?.get("utm_medium") ?? undefined,
    utmCampaign: params?.get("utm_campaign") ?? undefined,
    utmTerm: params?.get("utm_term") ?? undefined,
    utmContent: params?.get("utm_content") ?? undefined,
    referrer: referrer || undefined,
  });
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const found = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!found) return undefined;
  try { return decodeURIComponent(found.slice(name.length + 1)); } catch { return undefined; }
}

export function readAttributionClient(path: string): Attribution {
  if (!hasTrackingConsent(getConsent())) return { lastTouch: { landingPath: pathSchema.parse(path) } };
  const raw = getCookie(ATTRIBUTION_COOKIE.name);
  if (!raw) return { lastTouch: currentTouch(path) };
  try {
    const parsed = attributionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { lastTouch: currentTouch(path) };
  } catch {
    return { lastTouch: currentTouch(path) };
  }
}

export function captureAttributionClient(path: string, search: string, referrer?: string): Attribution {
  const consent = getConsent();
  if (!hasTrackingConsent(consent)) return { lastTouch: { landingPath: pathSchema.parse(path) } };

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const parsedCurrent = touchSchema.safeParse({
    landingPath: path,
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
    utmTerm: params.get("utm_term") ?? undefined,
    utmContent: params.get("utm_content") ?? undefined,
    referrer: referrer || undefined,
  });
  const current = parsedCurrent.success ? parsedCurrent.data : { landingPath: pathSchema.parse(path) };
  const existing = readAttributionClient(path);
  const next = attributionSchema.parse({
    firstTouch: existing.firstTouch ?? current,
    lastTouch: current,
  });
  if (typeof document !== "undefined") {
    document.cookie = `${ATTRIBUTION_COOKIE.name}=${encodeURIComponent(JSON.stringify(next))}; Max-Age=${ATTRIBUTION_COOKIE.maxAgeSeconds}; Path=/; SameSite=Lax; Secure`;
  }
  return next;
}

export function mergeAttribution(first: Attribution | undefined, latest: Attribution | undefined, currentPath: string, consented: boolean): Attribution {
  const safePath = pathSchema.parse(currentPath);
  if (!consented) return { lastTouch: { landingPath: safePath } };
  const saved = first ? attributionSchema.safeParse(first) : null;
  const submitted = latest ? attributionSchema.safeParse(latest) : null;
  const firstTouch = saved?.success ? saved.data.firstTouch : submitted?.success ? submitted.data.firstTouch : undefined;
  const lastTouch = submitted?.success ? submitted.data.lastTouch : undefined;
  return attributionSchema.parse({
    ...(firstTouch ? { firstTouch } : {}),
    lastTouch: lastTouch ?? firstTouch ?? { landingPath: safePath },
  });
}
