import { describe, expect, it } from "vitest";

import { videoReviewSla } from "../../src/config/moderation";

describe("video review SLA", () => {
  const submittedAt = new Date("2026-10-20T00:00:00.000Z");

  it("uses the provisional green, amber, and red thresholds", () => {
    expect(videoReviewSla(submittedAt, new Date("2026-10-20T23:59:59.000Z"))).toBe("GREEN");
    expect(videoReviewSla(submittedAt, new Date("2026-10-21T00:00:00.000Z"))).toBe("AMBER");
    expect(videoReviewSla(submittedAt, new Date("2026-10-22T00:00:01.000Z"))).toBe("RED");
  });
});
