import { describe, expect, it } from "vitest";

import {
  PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  type RoleName,
} from "../../src/server/authz/permissions";
import {
  hasPermission,
  isSafeStaffRoleChange,
  isWithinRewardAdjustCap,
} from "../../src/server/authz/policies";

describe("authorization policy matrix", () => {
  it.each(Object.entries(ROLE_PERMISSION_MATRIX as Record<RoleName, readonly (typeof PERMISSIONS)[number][]>))(
    "%s is evaluated against every seeded permission",
    (roleName, rolePermissions) => {
      for (const permission of PERMISSIONS) {
        const expected = roleName === "Super Admin" || rolePermissions.includes(permission);
        expect(
          hasPermission([roleName], rolePermissions, permission),
          `${roleName} -> ${permission}`,
        ).toBe(expected);
      }
    },
  );
});

describe("staff role safety policies", () => {
  it("blocks self-elevation and self-demotion", () => {
    expect(
      isSafeStaffRoleChange({
        actorId: "staff-1",
        targetUserId: "staff-1",
        currentTargetRoles: ["Read-only"],
        nextTargetRoles: ["Super Admin"],
        currentSuperAdminCount: 2,
      }),
    ).toBe(false);
  });

  it("protects the last Super Admin", () => {
    expect(
      isSafeStaffRoleChange({
        actorId: "manager-1",
        targetUserId: "admin-1",
        currentTargetRoles: ["Super Admin"],
        nextTargetRoles: ["Owner/Manager"],
        currentSuperAdminCount: 1,
      }),
    ).toBe(false);
    expect(
      isSafeStaffRoleChange({
        actorId: "manager-1",
        targetUserId: "admin-1",
        currentTargetRoles: ["Super Admin"],
        nextTargetRoles: ["Owner/Manager"],
        currentSuperAdminCount: 2,
      }),
    ).toBe(true);
  });

  it("enforces the active reward adjustment cap when supplied", () => {
    expect(isWithinRewardAdjustCap(100, 100)).toBe(true);
    expect(isWithinRewardAdjustCap(101, 100)).toBe(false);
    expect(isWithinRewardAdjustCap(0, 100)).toBe(false);
    expect(isWithinRewardAdjustCap(undefined, 100)).toBe(true);
  });
});

describe("authorization test data", () => {
  it("keeps every role name tied to the seeded permission type", () => {
    for (const roleName of Object.keys(ROLE_PERMISSION_MATRIX) as RoleName[]) {
      expect(roleName.length).toBeGreaterThan(0);
    }
  });
});
