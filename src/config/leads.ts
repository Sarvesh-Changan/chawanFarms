export const LEAD_FORM_LIMITS = {
  perIp: { max: 5, windowSeconds: 3_600 },
  perIdentity: { max: 3, windowSeconds: 3_600 },
  minFillMilliseconds: 3_000,
  clickEventsPerIp: { max: 20, windowSeconds: 3_600 },
} as const;

export const ATTRIBUTION_COOKIE = {
  name: "cf_attr",
  maxAgeSeconds: 30 * 24 * 60 * 60,
} as const;
