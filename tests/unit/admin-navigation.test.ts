import { describe, expect, it } from "vitest";

import { adminNavigation, filterAdminNavigation } from "@/config/admin-navigation";
import { ROLE_PERMISSION_MATRIX, type RoleName } from "@/server/authz/permissions";

const labels = (role: RoleName) => {
  // eslint-disable-next-line security/detect-object-injection
  return filterAdminNavigation(adminNavigation, new Set(ROLE_PERMISSION_MATRIX[role])).map((item) => item.label);
};

describe("permission-filtered admin navigation", () => {
  it.each([
    ["Super Admin", ["Dashboard", "Activity", "Stories", "Gallery", "Menu", "FAQ", "Packages", "Accommodation", "Bookings", "Enquiries", "Leads", "Rewards", "Settings", "Security"]],
    ["Owner/Manager", ["Dashboard", "Activity", "Stories", "Gallery", "Menu", "FAQ", "Packages", "Accommodation", "Bookings", "Enquiries", "Leads", "Rewards", "Settings", "Security"]],
    ["Reservations", ["Bookings", "Enquiries", "Leads"]],
    ["Content Editor", ["Activity", "Stories", "Gallery", "Menu", "FAQ", "Packages", "Accommodation", "Settings"]],
    ["Reward Moderator", ["Rewards"]],
    ["Read-only", ["Dashboard", "Activity", "Stories", "Gallery", "Menu", "FAQ", "Packages", "Accommodation", "Bookings", "Enquiries", "Leads", "Rewards", "Settings", "Security"]],
  ] as const)("shows only allowed sections for %s", (role, expected) => {
    expect(labels(role)).toEqual(expected);
  });

  it("keeps the legacy Experience editor out of the sidebar", () => {
    expect(labels("Super Admin")).not.toContain("Experiences");
    expect(adminNavigation.some((item) => item.href === "/admin/experiences-legacy")).toBe(false);
  });
});
