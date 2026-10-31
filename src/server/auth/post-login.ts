import "server-only";

import type { UserType } from "@/generated/prisma/client";
import type { PostLoginDestination } from "@/lib/auth/post-login-destination";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { requiresTwoFactor } from "@/server/authz/policies";
import { db } from "@/server/db";

export type PostLoginIdentity = {
  id: string;
  userType: UserType;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  roleNames: string[];
  permissionKeys: string[];
};

export async function getPostLoginIdentity(userId: string): Promise<PostLoginIdentity | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      type: true,
      emailVerified: true,
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
  if (!user) return null;
  return {
    id: user.id,
    userType: user.type,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    roleNames: user.staffRoles.map(({ role }) => role.name),
    permissionKeys: user.staffRoles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)),
  };
}

export function resolveIdentityPostLogin(
  identity: PostLoginIdentity,
  callbackUrl?: unknown,
  options: { needsTwoFactorVerify?: boolean; emailVerified?: boolean } = {},
): PostLoginDestination {
  const needsTwoFactorSetup = identity.userType === "STAFF"
    && requiresTwoFactor(identity.roleNames)
    && !identity.twoFactorEnabled;

  return resolvePostLoginDestination({
    userType: identity.userType,
    callbackUrl,
    needsTwoFactorSetup,
    needsTwoFactorVerify: options.needsTwoFactorVerify ?? false,
    emailVerified: options.emailVerified ?? identity.emailVerified,
  });
}

export async function resolveUserPostLogin(
  userId: string,
  callbackUrl?: unknown,
  options: { needsTwoFactorVerify?: boolean; emailVerified?: boolean } = {},
): Promise<PostLoginDestination | null> {
  const identity = await getPostLoginIdentity(userId);
  return identity ? resolveIdentityPostLogin(identity, callbackUrl, options) : null;
}
