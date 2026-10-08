import { createHash } from "node:crypto";

import "server-only";

import { z } from "zod";

import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { AuthorizationError } from "./errors";
import { PERMISSIONS, type Permission } from "./permissions";
import { hasPermission, isSafeStaffRoleChange, type AuthorizationContext } from "./policies";

export type AuthzUser = {
  id: string;
};

export type PermissionContext = AuthorizationContext & {
  actorId?: string;
  allowTwoFactorSetup?: boolean;
  inviteToken?: string;
};

export type StaffPrincipal = {
  id: string;
  type: "STAFF";
  status: string;
  roleNames: readonly string[];
  permissionKeys: readonly string[];
  twoFactorEnabled: boolean;
};

export type StaffInvitePrincipal = {
  kind: "staff-invite";
  inviteId: string;
  email: string;
  roleIds: readonly string[];
};

const permissionContextSchema = z
  .object({
    actorId: z.string().uuid().optional(),
    amount: z.number().int().optional(),
    allowTwoFactorSetup: z.boolean().optional(),
    targetUserId: z.string().uuid().optional(),
    roleChange: z
      .object({
        currentTargetRoles: z.array(z.string().min(1)),
        nextTargetRoles: z.array(z.string().min(1)),
        currentSuperAdminCount: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .strict();

const userSchema = z.object({ id: z.string().uuid() }).strict();

async function loadStaffUser(userId: string): Promise<StaffPrincipal | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      type: true,
      status: true,
      deletedAt: true,
      twoFactorEnabled: true,
      staffRoles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });

  if (!user || user.deletedAt || user.type !== "STAFF" || user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: user.id,
    type: "STAFF",
    status: user.status,
    roleNames: user.staffRoles.map(({ role }) => role.name),
    permissionKeys: user.staffRoles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

export async function getStaffPrincipal(userId: string): Promise<StaffPrincipal | null> {
  return loadStaffUser(userId);
}

export async function can(
  user: AuthzUser,
  permission: Permission,
  ctx?: PermissionContext,
): Promise<boolean> {
  const parsedUser = userSchema.safeParse(user);
  const parsedContext = ctx ? permissionContextSchema.safeParse(ctx) : { success: true as const, data: undefined };
  if (!parsedUser.success || !parsedContext.success) return false;

  const staffUser = await loadStaffUser(parsedUser.data.id);
  if (!staffUser) return false;

  if (requiresTwoFactor(staffUser.roleNames) && !staffUser.twoFactorEnabled) {
    if (!(parsedContext.data?.allowTwoFactorSetup && permission === "staff.read")) return false;
  }

  let rewardAdjustMaxPoints: number | undefined;
  if (permission === "rewards.adjust" && parsedContext.data?.amount !== undefined) {
    const activeRule = await db.rewardRule.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      select: { manualAdjustMaxPoints: true },
    });
    rewardAdjustMaxPoints = activeRule?.manualAdjustMaxPoints;
  }

  const context = parsedContext.data
    ? { ...parsedContext.data, actorId: parsedUser.data.id }
    : undefined;

  return hasPermission(
    staffUser.roleNames,
    staffUser.permissionKeys,
    permission,
    context,
    rewardAdjustMaxPoints,
  );
}

export async function requireStaff(): Promise<StaffPrincipal> {
  const session = await requireUser();
  const staffUser = await loadStaffUser(session.user.id);
  if (!staffUser) {
    throw new AuthorizationError("FORBIDDEN", "Staff access is required.");
  }
  return staffUser;
}

export async function requirePermission(
  permission: Permission,
  ctx?: PermissionContext,
): Promise<StaffPrincipal | StaffInvitePrincipal> {
  if (!PERMISSIONS.includes(permission)) {
    throw new AuthorizationError("FORBIDDEN", "The requested permission is unavailable.");
  }

  if (ctx?.inviteToken && permission === "staff.write") {
    const tokenHash = createHash("sha256").update(ctx.inviteToken).digest("hex");
    const invite = await db.staffInvite.findFirst({
      where: { tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, roleIds: true },
    });
    if (!invite) throw new AuthorizationError("FORBIDDEN", "This staff invitation is invalid or expired.");
    return { kind: "staff-invite", inviteId: invite.id, email: invite.email, roleIds: invite.roleIds };
  }

  const staffUser = await requireStaff();
  const allowed = await can(staffUser, permission, {
    ...ctx,
    actorId: staffUser.id,
  });

  if (!allowed) {
    throw new AuthorizationError("FORBIDDEN", "You do not have permission to perform this action.");
  }

  return staffUser;
}

export function requiresTwoFactor(roleNames: readonly string[]): boolean {
  return roleNames.includes("Super Admin") || roleNames.includes("Owner/Manager");
}

export function owns(user: AuthzUser, ownerId: string): boolean {
  return user.id === ownerId;
}

export function isSelf(user: AuthzUser, targetUserId: string): boolean {
  return owns(user, targetUserId);
}

export function requireOwnership(user: AuthzUser, ownerId: string): void {
  if (!owns(user, ownerId)) {
    throw new AuthorizationError("NOT_FOUND", "The requested resource was not found.");
  }
}

export function requireNotSelf(user: AuthzUser, targetUserId: string): void {
  if (isSelf(user, targetUserId)) {
    throw new AuthorizationError("FORBIDDEN", "You cannot change your own access.");
  }
}

export function assertSafeStaffRoleChange(input: {
  actorId: string;
  targetUserId: string;
  currentTargetRoles: readonly string[];
  nextTargetRoles: readonly string[];
  currentSuperAdminCount: number;
}): void {
  if (!isSafeStaffRoleChange(input)) {
    throw new AuthorizationError("CONFLICT", "This staff role change is not allowed.");
  }
}
