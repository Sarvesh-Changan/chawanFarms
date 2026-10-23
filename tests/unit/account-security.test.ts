import { describe, expect, it } from "vitest";

import { bookingOwnership, enquiryOwnership } from "@/lib/account-ownership";
import { deletionRequestSchema, profileUpdateSchema } from "@/lib/schemas/account";

function identity(id: string, emailVerified: boolean) {
  return { id, email: "guest@example.com", emailVerified, name: "Guest", status: "ACTIVE" as const, profile: null };
}

describe("account ownership rules", () => {
  it("uses the session user id for bookings and allows verified email-linked reads", () => {
    expect(bookingOwnership(identity("user-a", false))).toEqual({ OR: [{ userId: "user-a" }] });
    expect(bookingOwnership(identity("user-a", true))).toEqual({ OR: [{ userId: "user-a" }, { lead: { email: { equals: "guest@example.com", mode: "insensitive" } } }] });
  });

  it("uses the session user id for enquiries and never adds phone matching", () => {
    const filter = enquiryOwnership(identity("user-a", true));
    expect(JSON.stringify(filter)).toContain("guest@example.com");
    expect(JSON.stringify(filter)).not.toContain("phone");
    expect(enquiryOwnership(identity("user-a", false))).toEqual({ lead: { OR: [{ userId: "user-a" }] } });
  });
});

describe("account input validation", () => {
  it("limits deletion reasons and rejects unknown fields", () => {
    expect(deletionRequestSchema.safeParse({ reasonText: "ok", extra: true }).success).toBe(false);
    expect(deletionRequestSchema.safeParse({ reasonText: "x".repeat(1001) }).success).toBe(false);
  });

  it("requires the complete profile shape", () => {
    expect(profileUpdateSchema.safeParse({ name: "A", marketingConsent: false }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ name: "A Customer", phone: "+919821502956", city: "Kolad", marketingConsent: true }).success).toBe(true);
  });
});
