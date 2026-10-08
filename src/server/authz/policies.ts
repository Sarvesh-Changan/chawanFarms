import type { Permission } from "./permissions";

export type AuthorizationContext = {
  actorId?: string;
  amount?: number;
  targetUserId?: string;
  roleChange?: {
    currentTargetRoles: readonly string[];
    nextTargetRoles: readonly string[];
    currentSuperAdminCount: number;
  };
};

export function hasPermission(
  roleNames: readonly string[],
  permissionKeys: readonly string[],
  permission: Permission,
  context?: AuthorizationContext,
  rewardAdjustMaxPoints?: number,
): boolean {
  if (roleNames.includes("Super Admin")) {
    if (
      context?.roleChange &&
      !isSafeStaffRoleChange({
        actorId: context.actorId ?? "",
        targetUserId: context.targetUserId,
        ...context.roleChange,
      })
    ) {
      return false;
    }
    return permission !== "rewards.adjust" || isWithinRewardAdjustCap(context?.amount, rewardAdjustMaxPoints);
  }

  if (!permissionKeys.includes(permission)) return false;

  if (permission === "rewards.adjust") {
    return isWithinRewardAdjustCap(context?.amount, rewardAdjustMaxPoints);
  }

  if (context?.roleChange) {
    return isSafeStaffRoleChange({
      actorId: context.actorId ?? "",
      targetUserId: context.targetUserId,
      ...context.roleChange,
    });
  }

  return true;
}

export function isWithinRewardAdjustCap(
  amount: number | undefined,
  maxPoints: number | undefined,
): boolean {
  if (amount === undefined) return true;
  if (maxPoints === undefined || maxPoints < 0) return false;
  return Number.isInteger(amount) && amount > 0 && amount <= maxPoints;
}

export type StaffRoleChangeInput = {
  actorId: string;
  targetUserId?: string;
  currentTargetRoles: readonly string[];
  nextTargetRoles: readonly string[];
  currentSuperAdminCount: number;
};

export function isSafeStaffRoleChange(input: StaffRoleChangeInput): boolean {
  if (input.targetUserId && input.actorId === input.targetUserId) return false;

  const removingSuperAdmin =
    input.currentTargetRoles.includes("Super Admin") &&
    !input.nextTargetRoles.includes("Super Admin");

  if (removingSuperAdmin && input.currentSuperAdminCount <= 1) return false;

  return true;
}
