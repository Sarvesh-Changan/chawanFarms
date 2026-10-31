import { describe, expect, it } from "vitest";

import { canPublishPolicy } from "@/lib/policy-publishing";

describe("policy publishing safeguards", () => {
  it("keeps seeded D-2 policy versions unpublished but permits a resolved new version", () => {
    expect(canPublishPolicy({ key: "stay-rules-and-cancellation", pendingDecision: "D-2 cancellation conflict" })).toBe(false);
    expect(canPublishPolicy({ key: "stay-rules-and-cancellation" })).toBe(true);
    expect(canPublishPolicy({ key: "cancellation" })).toBe(true);
    expect(canPublishPolicy({ key: "privacy" })).toBe(true);
  });
});
