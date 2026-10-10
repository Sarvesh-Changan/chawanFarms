import "server-only";

import { cookies } from "next/headers";

import { ATTRIBUTION_COOKIE } from "@/config/leads";
import { attributionSchema, mergeAttribution } from "@/lib/attribution";
import { getConsentServer } from "@/server/consent";

export async function getValidatedAttribution(input: unknown, currentPath: string) {
  const consent = await getConsentServer();
  if (!consent.analytics && !consent.marketing) return mergeAttribution(undefined, undefined, currentPath, false);
  let cookieAttribution;
  try {
    const store = await cookies();
    const raw = store.get(ATTRIBUTION_COOKIE.name)?.value;
    if (raw && raw.length <= 8_192) {
      const parsed: unknown = JSON.parse(raw);
      const result = attributionSchema.safeParse(parsed);
      if (result.success) cookieAttribution = result.data;
    }
  } catch {
    cookieAttribution = undefined;
  }
  const client = attributionSchema.safeParse(input);
  return mergeAttribution(cookieAttribution, client.success ? client.data : undefined, currentPath, true);
}
