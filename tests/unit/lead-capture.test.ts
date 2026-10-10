import { afterEach, describe, expect, it, vi } from "vitest";

import { LEAD_FORM_LIMITS } from "@/config/leads";
import { captureAttributionClient, mergeAttribution } from "@/lib/attribution";
import { parseConsentCookie } from "@/lib/consent";
import { normalizeLeadPhone } from "@/lib/lead-phone";
import { isLeadHoneypotTripped } from "@/lib/lead-policy";
import { leadFormSchema } from "@/lib/schemas/leads";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "cf_consent=; Max-Age=0; Path=/";
  document.cookie = "cf_attr=; Max-Age=0; Path=/";
});

describe("lead capture privacy and validation", () => {
  it("denies tracking by default and does not write the attribution cookie", () => {
    expect(parseConsentCookie(undefined)).toEqual({ analytics: false, marketing: false });
    expect(parseConsentCookie("not-json")).toEqual({ analytics: false, marketing: false });
    const assignment = vi.spyOn(document, "cookie", "set");
    const result = captureAttributionClient("/contact", "?utm_source=mailer&utm_campaign=spring", "https://search.example/first");
    expect(result).toEqual({ lastTouch: { landingPath: "/contact" } });
    expect(assignment).not.toHaveBeenCalled();
    expect(mergeAttribution({ firstTouch: { landingPath: "/old", utmSource: "forged", referrer: "https://bad.example" } }, undefined, "/contact", false))
      .toEqual({ lastTouch: { landingPath: "/contact" } });
  });

  it("captures UTM data with granted consent and preserves first-touch while updating last-touch", () => {
    document.cookie = `cf_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: false }))}; Path=/`;
    const assignment = vi.spyOn(document, "cookie", "set");
    const first = captureAttributionClient("/packages", "?utm_source=search&utm_campaign=first", "https://search.example/query");
    expect(first.firstTouch?.utmSource).toBe("search");
    expect(assignment).toHaveBeenCalledWith(expect.stringContaining("cf_attr="));
    expect(assignment).toHaveBeenCalledWith(expect.stringContaining("Max-Age=2592000"));
    expect(assignment).toHaveBeenCalledWith(expect.stringContaining("SameSite=Lax; Secure"));

    assignment.mockRestore();
    document.cookie = `cf_attr=${encodeURIComponent(JSON.stringify(first))}; Path=/`;
    const later = captureAttributionClient("/activities", "?utm_source=social&utm_medium=post", "https://social.example/story");
    expect(later.firstTouch?.utmSource).toBe("search");
    expect(later.lastTouch?.utmSource).toBe("social");
    expect(later.lastTouch?.landingPath).toBe("/activities");
  });

  it("normalizes phone formats to E.164 and rejects malformed phone input", () => {
    expect(normalizeLeadPhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeLeadPhone("98765-43210")).toBe("+919876543210");
    expect(() => normalizeLeadPhone("not a phone")).toThrow("LEAD_PHONE_INVALID");
  });

  it("rejects honeypot submissions, invalid camp sizes, and non-consented contact", () => {
    expect(isLeadHoneypotTripped("filled by bot")).toBe(true);
    expect(isLeadHoneypotTripped("  ")).toBe(false);
    const base = { formType: "CAMP_ORGANISER", submissionId: crypto.randomUUID(), name: "Test Person", phone: "+919876543210", groupSize: 29, consentToContact: true, startedAt: Date.now() - 4_000, pagePath: "/contact" };
    expect(leadFormSchema.safeParse(base).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...base, groupSize: 30, consentToContact: false }).success).toBe(false);
  });

  it("uses the specified IP and phone/email rate-limit windows", () => {
    expect(LEAD_FORM_LIMITS.perIp).toEqual({ max: 5, windowSeconds: 3_600 });
    expect(LEAD_FORM_LIMITS.perIdentity).toEqual({ max: 3, windowSeconds: 3_600 });
  });
});
