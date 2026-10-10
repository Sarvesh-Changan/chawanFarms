import "server-only";

import { cookies } from "next/headers";

import { parseConsentCookie } from "@/lib/consent";

export async function getConsentServer() {
  try {
    const store = await cookies();
    return parseConsentCookie(store.get("cf_consent")?.value);
  } catch {
    return { analytics: false, marketing: false };
  }
}
