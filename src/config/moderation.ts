export const VIDEO_REVIEW_SLA_HOURS = 48;
export const VIDEO_REVIEW_AMBER_AFTER_HOURS = 24;
export const VIDEO_REVIEW_BOOKING_MATCH_DAYS = 3;
export const VIDEO_PREVIEW_TTL_SECONDS = 5 * 60;
export const VIDEO_PREVIEW_RATE_LIMIT = { max: 30, windowSeconds: 60 * 60 } as const;

export type VideoReviewSla = "GREEN" | "AMBER" | "RED";

export function videoReviewSla(submittedAt: Date, now = new Date()): VideoReviewSla {
  const ageHours = Math.max(0, now.getTime() - submittedAt.getTime()) / 3_600_000;
  if (ageHours < VIDEO_REVIEW_AMBER_AFTER_HOURS) return "GREEN";
  if (ageHours <= VIDEO_REVIEW_SLA_HOURS) return "AMBER";
  return "RED";
}
