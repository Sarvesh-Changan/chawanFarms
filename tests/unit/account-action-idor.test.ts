import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  // These are fixed repository paths used only for the authorization inventory.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFileSync(path, "utf8");
}

describe("customer account authorization inventory", () => {
  it("keeps every account mutation tied to the authenticated session", () => {
    const actions = source("src/server/actions/account.ts");
    for (const action of [
      "updateProfileAction",
      "redeemPointsAction",
      "withdrawVideoAction",
      "removeFavouriteAction",
      "markNotificationReadAction",
      "markAllNotificationsReadAction",
      "requestAccountDeletionAction",
      "cancelAccountDeletionAction",
    ]) {
      expect(actions).toContain(`export async function ${action}`);
    }
    expect(actions).toContain("async function activeCustomer");
    expect(actions).toContain("session.user.id");
    expect(actions).toContain("userId: session.user.id");
  });

  it("keeps existing favourite mutation scoped to session.user.id", () => {
    const actions = source("src/server/actions/favourites.ts");
    expect(actions).toContain("session.user.id");
    expect(actions).toContain("userId: session.user.id");
  });

  it("requires opaque-id ownership queries for both customer detail routes", () => {
    const booking = source("src/app/account/bookings/[id]/page.tsx");
    const enquiry = source("src/app/account/enquiries/[id]/page.tsx");
    expect(booking).toContain("getCustomerBooking(session.user.id, id)");
    expect(booking).toContain("notFound()");
    expect(enquiry).toContain("getCustomerEnquiry(session.user.id, id)");
    expect(enquiry).toContain("notFound()");
    expect(booking).not.toContain("reference]");
    expect(enquiry).not.toContain("reference]");
  });
});
