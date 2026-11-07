"use server";

import { createHash, randomBytes } from "node:crypto";

import { createOTP } from "@better-auth/utils/otp";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { env } from "@/config/env";
import { validateAdminPassword } from "@/lib/auth/password-policy";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { err, ok, type Result } from "@/lib/result";
import { matchesCurrentSessionToken } from "@/lib/security/sessions";
import { auth, getSession } from "@/server/auth";
import { verifyFreshSession } from "@/server/auth/fresh-session";
import { assertSafeStaffRoleChange, requirePermission, requireStaff, type StaffPrincipal } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { requiresTwoFactor } from "@/server/authz/policies";
import { db } from "@/server/db";
import {
  sendStaffAccountCreatedEmail,
  sendStaffAccountDeletedEmail,
  sendStaffInviteEmail,
} from "@/server/integrations/email";
import { limit } from "@/server/integrations/ratelimit";
import { verifyTurnstileToken } from "@/server/integrations/turnstile";
import { audit } from "@/server/services/audit";

const uuidSchema = z.string().uuid();
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{40,64}$/);

const inviteSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  roleIds: z.array(uuidSchema).min(1).max(20).refine((items) => new Set(items).size === items.length),
}).strict();

const revokeInviteSchema = z.object({ inviteId: uuidSchema }).strict();

const createStaffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Invalid email address").max(254).transform((value) => value.toLowerCase()),
  roleId: uuidSchema,
  initialPassword: z.string().min(12, "Password must be at least 12 characters").max(128),
  freshSessionPassword: z.string().optional(),
  freshSessionTotpCode: z.string().optional(),
}).strict();

const updateStaffNameSchema = z.object({
  targetUserId: uuidSchema,
  name: z.string().trim().min(1, "Name is required").max(120),
}).strict();

const changeRolesSchema = z.object({
  targetUserId: uuidSchema,
  roleIds: z.array(uuidSchema).max(20).refine((items) => new Set(items).size === items.length),
  freshSessionPassword: z.string().optional(),
  freshSessionTotpCode: z.string().optional(),
}).strict();

const disableStaffSchema = z.object({
  targetUserId: uuidSchema,
  freshSessionPassword: z.string().min(1, "Password is required for sensitive operations"),
  freshSessionTotpCode: z.string().optional(),
}).strict();

const enableStaffSchema = z.object({
  targetUserId: uuidSchema,
}).strict();

const resetStaffPasswordSchema = z.object({
  targetUserId: uuidSchema,
  freshSessionPassword: z.string().min(1, "Password is required for sensitive operations"),
  freshSessionTotpCode: z.string().optional(),
}).strict();

const revokeStaffSessionsSchema = z.object({
  targetUserId: uuidSchema,
}).strict();

const deleteStaffSchema = z.object({
  targetUserId: uuidSchema,
  confirmEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  freshSessionPassword: z.string().min(1, "Password is required for sensitive operations"),
  freshSessionTotpCode: z.string().optional(),
}).strict();

const forceChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(12, "New password must be at least 12 characters").max(128),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).strict().superRefine((data, ctx) => {
  if (data.newPassword !== data.confirmPassword) {
    ctx.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirmPassword"] });
  }
});

const acceptInviteSchema = z.object({
  token: tokenSchema,
  email: z.string().trim().email().max(254).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(10).max(128).optional(),
  turnstileToken: z.string().max(2048).optional(),
}).strict().superRefine((input, context) => {
  if (input.password && !input.email) context.addIssue({ code: "custom", message: "Email is required when creating an account." });
  if (input.password && !input.name) context.addIssue({ code: "custom", message: "Name is required when creating an account." });
});

const revokeSessionSchema = z.object({ sessionId: uuidSchema }).strict();

function validationError(): Result<never> {
  return err("VALIDATION", "Please check the submitted details.");
}

function generateBase32Secret(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = randomBytes(length);
  let secret = "";
  for (let i = 0; i < length; i++) {
    const byte = bytes.at(i) ?? 0;
    secret += chars.charAt(byte % chars.length);
  }
  return secret;
}

function generateBackupCodes(count = 10, length = 8): string[] {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(length);
    let code = "";
    for (let j = 0; j < length; j++) {
      const byte = bytes.at(j) ?? 0;
      code += chars.charAt(byte % chars.length);
    }
    codes.push(code);
  }
  return codes;
}

function generateTemporaryPassword(length = 16): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";
  const all = uppercase + lowercase + numbers + symbols;
  const bytes = randomBytes(length);
  const chars: string[] = [
    uppercase.charAt((bytes.at(0) ?? 0) % uppercase.length),
    lowercase.charAt((bytes.at(1) ?? 0) % lowercase.length),
    numbers.charAt((bytes.at(2) ?? 0) % numbers.length),
    symbols.charAt((bytes.at(3) ?? 0) % symbols.length),
  ];
  for (let i = 4; i < length; i++) {
    const byte = bytes.at(i) ?? 0;
    chars.push(all.charAt(byte % all.length));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const rand = randomBytes(1).at(0) ?? 0;
    const j = rand % (i + 1);
    const charI = chars.at(i) ?? "";
    const charJ = chars.at(j) ?? "";
    chars.splice(i, 1, charJ);
    chars.splice(j, 1, charI);
  }
  return chars.join("");
}

async function requestAudit(actorId: string, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown) {
  const requestHeaders = await headers();
  return audit({
    actor: { id: actorId, type: "STAFF" },
    action,
    entityType,
    entityId,
    before,
    after,
    ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128) ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 128),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });
}

async function auditAuthorizationDenial(permission: string, error: AuthorizationError) {
  const requestHeaders = await headers();
  await audit({
    actor: null,
    action: "authz.permission.denied",
    entityType: "Permission",
    entityId: permission,
    after: { code: error.code },
    ip: requestHeaders.get("cf-connecting-ip")?.slice(0, 128) ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 128),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128),
  });
}

async function authorizeStaff(permission: "staff.read" | "staff.write" | "roles.write", ctx?: { allowTwoFactorSetup?: boolean }): Promise<Result<StaffPrincipal>> {
  try {
    const principal = await requirePermission(permission, ctx);
    return "id" in principal ? ok(principal) : err("FORBIDDEN", "Staff access is required.");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      await auditAuthorizationDenial(permission, error);
      return err(error.code, error.message);
    }
    throw error;
  }
}

export async function inviteStaffAction(rawInput: unknown): Promise<Result<{ inviteId: string }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const parsed = inviteSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const roles = await db.role.findMany({ where: { id: { in: parsed.data.roleIds } }, select: { id: true, name: true } });
  if (roles.length !== parsed.data.roleIds.length) return err("VALIDATION", "One or more selected roles are unavailable.");
  if (roles.some(({ name }) => name === "Super Admin")) {
    const roleAccess = await authorizeStaff("roles.write");
    if (!roleAccess.ok) return err(roleAccess.error.code, roleAccess.error.message);
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  try {
    const invite = await db.$transaction(async (transaction) => {
      await transaction.staffInvite.updateMany({
        where: { email: parsed.data.email, usedAt: null, revokedAt: null, expiresAt: { lte: new Date() } },
        data: { revokedAt: new Date() },
      });
      return transaction.staffInvite.create({
        data: { email: parsed.data.email, roleIds: parsed.data.roleIds, tokenHash, expiresAt, invitedById: actor.id },
        select: { id: true },
      });
    });
    const url = new URL("/staff-invite", env.NEXT_PUBLIC_SITE_URL);
    url.searchParams.set("token", rawToken);
    try {
      await sendStaffInviteEmail({ to: parsed.data.email, url: url.toString() });
    } catch {
      await db.staffInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
      return err("UNAVAILABLE", "The invitation email could not be delivered. Try again later.");
    }
    const auditResult = await requestAudit(actor.id, "staff.invite.create", "StaffInvite", invite.id, null, { email: parsed.data.email, roleIds: parsed.data.roleIds, expiresAt });
    if (!auditResult.ok) return auditResult;
    return ok({ inviteId: invite.id });
  } catch {
    return err("CONFLICT", "Unable to create or deliver this invitation. Check for an existing pending invite.");
  }
}

export async function revokeStaffInviteAction(rawInput: unknown): Promise<Result<{ revoked: true }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const parsed = revokeInviteSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const updated = await db.staffInvite.updateMany({
    where: { id: parsed.data.inviteId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (updated.count !== 1) return err("NOT_FOUND", "The pending invitation was not found.");
  const auditResult = await requestAudit(actor.id, "staff.invite.revoke", "StaffInvite", parsed.data.inviteId, { pending: true }, { revoked: true });
  return auditResult.ok ? ok({ revoked: true }) : auditResult;
}

export async function acceptStaffInviteAction(rawInput: unknown): Promise<Result<{ accepted: true; verificationRequired: boolean }>> {
  const candidate = typeof rawInput === "object" && rawInput !== null && "token" in rawInput && typeof rawInput.token === "string" ? rawInput.token : "";
  let grant: Awaited<ReturnType<typeof requirePermission>>;
  try {
    grant = await requirePermission("staff.write", { inviteToken: candidate });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      await auditAuthorizationDenial("staff.write", error);
      return err(error.code, error.message);
    }
    throw error;
  }
  if (!("kind" in grant)) return err("FORBIDDEN", "A valid staff invitation is required.");
  const parsed = acceptInviteSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  const session = await getSession();
  if (session && parsed.data.email && parsed.data.email.toLowerCase() !== session.user.email.toLowerCase()) return err("FORBIDDEN", "This invitation was sent to a different email address.");
  const email = (session?.user.email ?? parsed.data.email ?? "").trim().toLowerCase();
  if (!email || email !== grant.email.toLowerCase()) return err("FORBIDDEN", "This invitation was sent to a different email address.");

  let userId = session?.user.id;
  let verificationRequired = false;
  if (!userId) {
    if (!parsed.data.email || !parsed.data.password || !parsed.data.name) return err("VALIDATION", "Sign in or create an account with the invited email address.");
    try {
      const requestHeaders = await headers();
      const forwardedIp = requestHeaders.get("cf-connecting-ip")?.split(",")[0]?.trim()
        ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? "unknown";
      const ip = /^[0-9a-fA-F:.]{3,128}$/.test(forwardedIp) ? forwardedIp : "unknown";
      const emailKey = createHash("sha256").update(email).digest("hex");
      const [ipLimit, emailLimit] = await Promise.all([
        limit(`auth:staff-invite:ip:${ip}`, 5, 3_600),
        limit(`auth:staff-invite:email:${emailKey}`, 5, 3_600),
      ]);
      if (!ipLimit.allowed || !emailLimit.allowed) return err("RATE_LIMITED", "Too many attempts. Please try again later.");
      if (!(await verifyTurnstileToken(parsed.data.turnstileToken, ip))) {
        return err("VALIDATION", "Please complete the security check.");
      }
      const verificationDestination = resolvePostLoginDestination({
        userType: "STAFF",
        callbackUrl: "/admin",
        needsTwoFactorSetup: false,
        needsTwoFactorVerify: false,
        emailVerified: false,
      });
      const created = await auth.api.signUpEmail({
        body: { name: parsed.data.name, email, password: parsed.data.password, callbackURL: verificationDestination.redirectTo },
        headers: requestHeaders,
      });
      userId = created.user.id;
      verificationRequired = true;
    } catch {
      return err("CONFLICT", "An account may already exist. Sign in with the invited email to accept the invitation.");
    }
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, type: true } });
  if (!user || user.email.toLowerCase() !== grant.email.toLowerCase()) return err("FORBIDDEN", "This invitation was sent to a different email address.");

  try {
    await db.$transaction(async (transaction) => {
      const invitation = await transaction.staffInvite.findFirst({
        where: { id: grant.inviteId, tokenHash: createHash("sha256").update(parsed.data.token).digest("hex"), usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, roleIds: true, invitedById: true },
      });
      if (!invitation) throw new AuthorizationError("CONFLICT", "This staff invitation has already been used or expired.");
      const roles = await transaction.role.findMany({ where: { id: { in: invitation.roleIds } }, select: { id: true } });
      if (roles.length !== invitation.roleIds.length) throw new AuthorizationError("CONFLICT", "The invitation contains unavailable roles.");
      const claimed = await transaction.staffInvite.updateMany({
        where: { id: invitation.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new AuthorizationError("CONFLICT", "This staff invitation has already been used.");
      await transaction.user.update({ where: { id: userId }, data: { type: "STAFF" } });
      await transaction.staffRole.createMany({ data: roles.map(({ id }) => ({ userId, roleId: id, assignedById: invitation.invitedById })), skipDuplicates: true });
      await transaction.session.deleteMany({ where: { userId } });
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return err(error.code, error.message);
    return err("INTERNAL", "The staff invitation could not be accepted.");
  }

  const auditResult = await audit({ actor: { id: userId, type: "STAFF" }, action: "staff.invite.accept", entityType: "StaffInvite", entityId: grant.inviteId, before: { used: false }, after: { userId, roleIds: grant.roleIds } });
  if (!auditResult.ok) return auditResult;
  return ok({ accepted: true, verificationRequired });
}

export async function createStaffAccountAction(rawInput: unknown): Promise<Result<{ user: { id: string; email: string; name: string } }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;

  // Strict role-based check: Super Admin only
  if (!actor.roleNames.includes("Super Admin")) {
    return err("FORBIDDEN", "Super Admin role is required to create staff accounts.");
  }

  const parsed = createStaffSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const rate = await limit(`admin:staff-create:${actor.id}`, 10, 3600);
  if (!rate.allowed) return err("RATE_LIMITED", "Too many account creations. Please try again later.");

  const selectedRole = await db.role.findUnique({
    where: { id: parsed.data.roleId },
    select: { id: true, name: true },
  });
  if (!selectedRole) return err("VALIDATION", "Selected role was not found.");

  // If creating a Super Admin, require fresh session authentication
  if (selectedRole.name === "Super Admin") {
    if (!parsed.data.freshSessionPassword) {
      return err("VALIDATION", "Current password is required to create a Super Admin account.");
    }
    const freshResult = await verifyFreshSession(actor.id, {
      password: parsed.data.freshSessionPassword,
      totpCode: parsed.data.freshSessionTotpCode,
    });
    if (!freshResult.ok) return freshResult;
  }

  // Refuse emails that already belong to customer or staff accounts
  const existingUser = await db.user.findFirst({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existingUser) {
    return err("CONFLICT", "An account with this email address already exists.");
  }

  // Validate password policy
  const passwordPolicy = validateAdminPassword(parsed.data.initialPassword, parsed.data.email);
  if (!passwordPolicy.valid) {
    return err("VALIDATION", passwordPolicy.reason);
  }

  const hashedPassword = await hashPassword(parsed.data.initialPassword);

  try {
    const newUser = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          type: "STAFF",
          status: "ACTIVE",
          emailVerified: true,
          mustChangePassword: true,
          twoFactorEnabled: false,
        },
        select: { id: true, email: true, name: true },
      });

      await tx.account.create({
        data: {
          userId: created.id,
          providerId: "credential",
          accountId: created.id,
          password: hashedPassword,
        },
      });

      await tx.staffRole.create({
        data: {
          userId: created.id,
          roleId: selectedRole.id,
          assignedById: actor.id,
        },
      });

      return created;
    });

    await requestAudit(
      actor.id,
      "staff.account.create",
      "User",
      newUser.id,
      null,
      {
        email: newUser.email,
        name: newUser.name,
        role: selectedRole.name,
      },
    );

    await sendStaffAccountCreatedEmail({
      to: newUser.email,
      name: newUser.name,
      roleNames: [selectedRole.name],
      loginUrl: `${env.NEXT_PUBLIC_SITE_URL}/login?callbackUrl=/admin`,
    });

    return ok({ user: newUser });
  } catch (error) {
    console.error("[staff.account.create] error", error);
    return err("INTERNAL", "The staff account could not be created.");
  }
}

export async function updateStaffNameAction(rawInput: unknown): Promise<Result<{ updated: true }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;

  const parsed = updateStaffNameSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const target = await db.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, name: true, type: true, deletedAt: true },
  });
  if (!target || target.type !== "STAFF" || target.deletedAt) {
    return err("NOT_FOUND", "Staff member not found.");
  }

  await db.user.update({
    where: { id: target.id },
    data: { name: parsed.data.name },
  });

  await requestAudit(actor.id, "staff.name.update", "User", target.id, { name: target.name }, { name: parsed.data.name });

  return ok({ updated: true });
}

export async function changeStaffRolesAction(rawInput: unknown): Promise<Result<{ updated: true }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const roleAccess = await authorizeStaff("roles.write");
  if (!roleAccess.ok) return err(roleAccess.error.code, roleAccess.error.message);
  const parsed = changeRolesSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  if (actor.id === parsed.data.targetUserId) return err("FORBIDDEN", "You cannot change your own access.");

  const target = await db.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, type: true, staffRoles: { select: { roleId: true, role: { select: { name: true } } } } },
  });
  if (!target || target.type !== "STAFF") return err("NOT_FOUND", "Staff member not found.");

  const nextRoles = await db.role.findMany({ where: { id: { in: parsed.data.roleIds } }, select: { id: true, name: true } });
  if (nextRoles.length !== parsed.data.roleIds.length) return err("VALIDATION", "One or more roles are unavailable.");

  const oldRoleNames = target.staffRoles.map(({ role }) => role.name);
  const newRoleNames = nextRoles.map(({ name }) => name);

  const grantingSuperAdmin = newRoleNames.includes("Super Admin") && !oldRoleNames.includes("Super Admin");
  const removingSuperAdmin = oldRoleNames.includes("Super Admin") && !newRoleNames.includes("Super Admin");

  // Only Super Admins can grant or remove the Super Admin role
  if ((grantingSuperAdmin || removingSuperAdmin) && !actor.roleNames.includes("Super Admin")) {
    return err("FORBIDDEN", "Only Super Admins can grant or remove the Super Admin role.");
  }

  // Fresh session required when promoting to Super Admin
  if (grantingSuperAdmin) {
    if (!parsed.data.freshSessionPassword) {
      return err("VALIDATION", "Current password is required to promote an account to Super Admin.");
    }
    const freshResult = await verifyFreshSession(actor.id, {
      password: parsed.data.freshSessionPassword,
      totpCode: parsed.data.freshSessionTotpCode,
    });
    if (!freshResult.ok) return freshResult;
  }

  try {
    const beforeAndAfter = await db.$transaction(async (transaction) => {
      const superAdminCount = await transaction.staffRole.count({
        where: { role: { name: "Super Admin" }, user: { status: "ACTIVE", type: "STAFF" } },
      });
      assertSafeStaffRoleChange({
        actorId: actor.id,
        targetUserId: target.id,
        currentTargetRoles: oldRoleNames,
        nextTargetRoles: newRoleNames,
        currentSuperAdminCount: superAdminCount,
      });

      await transaction.staffRole.deleteMany({ where: { userId: target.id } });
      if (nextRoles.length) {
        await transaction.staffRole.createMany({
          data: nextRoles.map(({ id }) => ({ userId: target.id, roleId: id, assignedById: actor.id })),
        });
      }
      const sessionsRevoked = await transaction.session.deleteMany({ where: { userId: target.id } });
      return { before: oldRoleNames, after: newRoleNames, sessionsRevoked: sessionsRevoked.count };
    }, { isolationLevel: "Serializable" });

    const auditResult = await requestAudit(actor.id, "staff.roles.update", "User", parsed.data.targetUserId, beforeAndAfter.before, {
      roles: beforeAndAfter.after,
      sessionsRevoked: beforeAndAfter.sessionsRevoked,
    });
    return auditResult.ok ? ok({ updated: true }) : auditResult;
  } catch (error) {
    if (error instanceof AuthorizationError) return err(error.code, error.message);
    return err("CONFLICT", "The role change could not be completed safely.");
  }
}

export async function disableStaffAction(rawInput: unknown): Promise<Result<{ disabled: true }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const parsed = disableStaffSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  if (actor.id === parsed.data.targetUserId) return err("FORBIDDEN", "You cannot disable your own access.");

  const freshResult = await verifyFreshSession(actor.id, {
    password: parsed.data.freshSessionPassword,
    totpCode: parsed.data.freshSessionTotpCode,
  });
  if (!freshResult.ok) return freshResult;

  try {
    const result = await db.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: parsed.data.targetUserId },
        select: { id: true, status: true, type: true, staffRoles: { select: { role: { select: { name: true } } } } },
      });
      if (!target || target.type !== "STAFF") throw new AuthorizationError("NOT_FOUND", "Staff member not found.");
      const wasSuperAdmin = target.staffRoles.some(({ role }) => role.name === "Super Admin");
      if (wasSuperAdmin) {
        const activeSuperAdmins = await transaction.staffRole.count({
          where: { role: { name: "Super Admin" }, user: { type: "STAFF", status: "ACTIVE" } },
        });
        if (activeSuperAdmins <= 1) throw new AuthorizationError("CONFLICT", "The last active Super Admin cannot be disabled.");
      }
      const revokedSessions = await transaction.session.deleteMany({ where: { userId: target.id } });
      await transaction.user.update({ where: { id: target.id }, data: { status: "SUSPENDED" } });
      return { beforeStatus: target.status, revokedSessions: revokedSessions.count };
    }, { isolationLevel: "Serializable" });

    const auditResult = await requestAudit(actor.id, "staff.disable", "User", parsed.data.targetUserId, { status: result.beforeStatus }, {
      status: "SUSPENDED",
      revokedSessions: result.revokedSessions,
    });
    return auditResult.ok ? ok({ disabled: true }) : auditResult;
  } catch (error) {
    if (error instanceof AuthorizationError) return err(error.code, error.message);
    return err("CONFLICT", "The staff account could not be disabled.");
  }
}

export async function enableStaffAction(rawInput: unknown): Promise<Result<{ enabled: true }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;

  const parsed = enableStaffSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const target = await db.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, status: true, type: true, email: true, deletedAt: true },
  });
  if (!target || target.type !== "STAFF") return err("NOT_FOUND", "Staff member not found.");
  if (target.deletedAt || target.email.endsWith("@invalid.local")) {
    return err("FORBIDDEN", "Deleted or anonymised accounts cannot be re-enabled.");
  }

  await db.user.update({
    where: { id: target.id },
    data: { status: "ACTIVE" },
  });

  await requestAudit(actor.id, "staff.enable", "User", target.id, { status: target.status }, { status: "ACTIVE" });

  return ok({ enabled: true });
}

export async function resetStaffPasswordAction(rawInput: unknown): Promise<Result<{ temporaryPassword: string }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;

  if (!actor.roleNames.includes("Super Admin")) {
    return err("FORBIDDEN", "Super Admin role is required to reset passwords.");
  }

  const parsed = resetStaffPasswordSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const freshResult = await verifyFreshSession(actor.id, {
    password: parsed.data.freshSessionPassword,
    totpCode: parsed.data.freshSessionTotpCode,
  });
  if (!freshResult.ok) return freshResult;

  const rate = await limit(`admin:staff-reset-pw:${actor.id}`, 10, 3600);
  if (!rate.allowed) return err("RATE_LIMITED", "Too many password resets. Please try again later.");

  const target = await db.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, email: true, type: true, deletedAt: true },
  });
  if (!target || target.type !== "STAFF" || target.deletedAt) {
    return err("NOT_FOUND", "Staff member not found.");
  }

  const temporaryPassword = generateTemporaryPassword(16);
  const hashedPassword = await hashPassword(temporaryPassword);

  await db.$transaction(async (tx) => {
    const existingAccount = await tx.account.findFirst({
      where: { userId: target.id, providerId: "credential" },
    });

    if (existingAccount) {
      await tx.account.update({
        where: { id: existingAccount.id },
        data: { password: hashedPassword },
      });
    } else {
      await tx.account.create({
        data: {
          userId: target.id,
          providerId: "credential",
          accountId: target.id,
          password: hashedPassword,
        },
      });
    }

    await tx.user.update({
      where: { id: target.id },
      data: { mustChangePassword: true },
    });

    await tx.session.deleteMany({ where: { userId: target.id } });
  });

  await requestAudit(actor.id, "staff.password.reset", "User", target.id, null, { mustChangePassword: true, sessionsRevoked: true });

  return ok({ temporaryPassword });
}

export async function revokeStaffSessionsAction(rawInput: unknown): Promise<Result<{ revoked: number }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;

  const parsed = revokeStaffSessionsSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const target = await db.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, type: true },
  });
  if (!target || target.type !== "STAFF") return err("NOT_FOUND", "Staff member not found.");

  const deleted = await db.session.deleteMany({ where: { userId: target.id } });

  await requestAudit(actor.id, "staff.sessions.revoke", "User", target.id, null, { revokedSessions: deleted.count });

  return ok({ revoked: deleted.count });
}

export async function deleteStaffAccountAction(rawInput: unknown): Promise<Result<{ deleted: true }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;

  if (!actor.roleNames.includes("Super Admin")) {
    return err("FORBIDDEN", "Super Admin role is required to delete staff accounts.");
  }

  const parsed = deleteStaffSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  if (actor.id === parsed.data.targetUserId) {
    return err("FORBIDDEN", "You cannot delete your own account.");
  }

  const freshResult = await verifyFreshSession(actor.id, {
    password: parsed.data.freshSessionPassword,
    totpCode: parsed.data.freshSessionTotpCode,
  });
  if (!freshResult.ok) return freshResult;

  const rate = await limit(`admin:staff-delete:${actor.id}`, 5, 3600);
  if (!rate.allowed) return err("RATE_LIMITED", "Too many account deletions. Please try again later.");

  try {
    const deleteResult = await db.$transaction(async (tx) => {
      // Row lock staff accounts to prevent concurrent delete races
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT id FROM "user" WHERE type = 'STAFF' FOR UPDATE`;
      }

      const targetUser = await tx.user.findUnique({
        where: { id: parsed.data.targetUserId },
        select: {
          id: true,
          email: true,
          name: true,
          type: true,
          status: true,
          deletedAt: true,
          staffRoles: {
            select: { role: { select: { id: true, name: true } } },
          },
        },
      });

      if (!targetUser || targetUser.type !== "STAFF") {
        throw new AuthorizationError("NOT_FOUND", "Staff member not found.");
      }

      if (parsed.data.confirmEmail.toLowerCase() !== targetUser.email.toLowerCase()) {
        throw new AuthorizationError("VALIDATION", "Confirmation email does not match.");
      }

      const wasSuperAdmin = targetUser.staffRoles.some((r) => r.role.name === "Super Admin");

      if (wasSuperAdmin) {
        // Find remaining eligible active Super Admins who have completed a login and have TOTP enrolled
        const remainingEligibleSuperAdmins = await tx.user.findMany({
          where: {
            id: { not: targetUser.id },
            type: "STAFF",
            status: "ACTIVE",
            deletedAt: null,
            lastLoginAt: { not: null },
            mustChangePassword: false,
            twoFactorEnabled: true,
            staffRoles: {
              some: {
                role: {
                  name: "Super Admin",
                },
              },
            },
          },
          select: { id: true, email: true },
        });

        if (remainingEligibleSuperAdmins.length === 0) {
          throw new AuthorizationError(
            "CONFLICT",
            "Cannot delete this Super Admin. There must remain at least one other active Super Admin who has logged in and has two-factor authentication enabled.",
          );
        }
      }

      // Revoke all sessions, credentials, TOTP secrets, invites
      await tx.session.deleteMany({ where: { userId: targetUser.id } });
      await tx.account.deleteMany({ where: { userId: targetUser.id } });
      await tx.twoFactor.deleteMany({ where: { userId: targetUser.id } });
      await tx.staffInvite.updateMany({
        where: { email: targetUser.email, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Count external references
      const [
        bookingsCount,
        videosCount,
        ledgerCount,
        auditCount,
        adjustmentRequestsCount,
        decidedAdjustmentsCount,
        assignedRolesCount,
      ] = await Promise.all([
        tx.booking.count({ where: { userId: targetUser.id } }),
        tx.videoSubmission.count({ where: { userId: targetUser.id } }),
        tx.pointsLedger.count({ where: { userId: targetUser.id } }),
        tx.auditLog.count({ where: { actorId: targetUser.id } }),
        tx.pointsAdjustmentRequest.count({
          where: { OR: [{ userId: targetUser.id }, { requestedById: targetUser.id }] },
        }),
        tx.pointsAdjustmentRequest.count({
          where: { decidedById: targetUser.id },
        }),
        tx.staffRole.count({ where: { assignedById: targetUser.id } }),
      ]);

      const totalReferences =
        bookingsCount +
        videosCount +
        ledgerCount +
        auditCount +
        adjustmentRequestsCount +
        decidedAdjustmentsCount +
        assignedRolesCount;

      await tx.staffRole.deleteMany({ where: { userId: targetUser.id } });

      if (totalReferences > 0) {
        // Anonymise user
        const anonymisedEmail = `deleted-${targetUser.id}@invalid.local`;
        await tx.user.update({
          where: { id: targetUser.id },
          data: {
            email: anonymisedEmail,
            name: "Deleted admin",
            status: "SUSPENDED",
            twoFactorEnabled: false,
            mustChangePassword: false,
            deletedAt: new Date(),
          },
        });
        return { anonymised: true, targetUser };
      } else {
        // Hard delete
        await tx.user.delete({ where: { id: targetUser.id } });
        return { anonymised: false, targetUser };
      }
    }, { isolationLevel: "Serializable" });

    // Send alert email to all remaining active Super Admins
    const remainingSuperAdmins = await db.user.findMany({
      where: {
        type: "STAFF",
        status: "ACTIVE",
        deletedAt: null,
        staffRoles: { some: { role: { name: "Super Admin" } } },
      },
      select: { email: true },
    });

    await Promise.all(
      remainingSuperAdmins.map((admin) =>
        Promise.resolve(
          sendStaffAccountDeletedEmail({
            to: admin.email,
            deletedAdminEmail: deleteResult.targetUser.email,
            actorEmail: actor.email,
          }),
        ).catch((err) => console.error("[email] failed sending deletion alert", err)),
      ),
    );

    await requestAudit(
      actor.id,
      "staff.account.delete",
      "User",
      deleteResult.targetUser.id,
      {
        email: deleteResult.targetUser.email,
        name: deleteResult.targetUser.name,
        roles: deleteResult.targetUser.staffRoles.map((r) => r.role.name),
      },
      {
        anonymised: deleteResult.anonymised,
        hardDeleted: !deleteResult.anonymised,
      },
    );

    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return err(error.code, error.message);
    return err("CONFLICT", "The staff account could not be deleted safely.");
  }
}

export async function forceChangePasswordAction(rawInput: unknown): Promise<Result<{ redirectTo: string }>> {
  const staff = await requireStaff();
  const session = await getSession();
  if (!session) return err("UNAUTHENTICATED", "Session required.");

  const parsed = forceChangePasswordSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();

  const policy = validateAdminPassword(parsed.data.newPassword, session.user.email);
  if (!policy.valid) {
    return err("VALIDATION", policy.reason);
  }

  const account = await db.account.findFirst({
    where: { userId: staff.id, providerId: "credential" },
    select: { id: true, password: true },
  });

  if (!account?.password) {
    return err("UNAUTHENTICATED", "Credentials not found.");
  }

  const validCurrent = await verifyPassword({
    hash: account.password,
    password: parsed.data.currentPassword,
  });

  if (!validCurrent) {
    return err("UNAUTHENTICATED", "Current password is incorrect.");
  }

  const hashedNewPassword = await hashPassword(parsed.data.newPassword);

  await db.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: account.id },
      data: { password: hashedNewPassword },
    });

    await tx.user.update({
      where: { id: staff.id },
      data: { mustChangePassword: false },
    });

    // Revoke all other sessions for this user
    await tx.session.deleteMany({
      where: {
        userId: staff.id,
        token: { not: session.session.token },
      },
    });
  });

  await requestAudit(staff.id, "auth.password.forced_change", "User", staff.id, null, { mustChangePassword: false });

  // If role requires 2FA and not enabled, route to 2FA setup
  const nextRedirect = requiresTwoFactor(staff.roleNames) && !staff.twoFactorEnabled
    ? "/admin/security/two-factor?step=setup"
    : "/admin";

  return ok({ redirectTo: nextRedirect });
}

export async function startTwoFactorSetupAction(): Promise<Result<{ totpURI: string; secret: string; backupCodes: string[] }>> {
  const staff = await requireStaff();
  const session = await getSession();
  if (!session) return err("UNAUTHENTICATED", "Session required.");

  const rate = await limit(`admin:2fa-setup:${staff.id}`, 5, 3600);
  if (!rate.allowed) return err("RATE_LIMITED", "Too many setup attempts. Please try again later.");

  const secret = generateBase32Secret(32);
  const backupCodes = generateBackupCodes(10, 8);

  await db.twoFactor.upsert({
    where: { userId: staff.id },
    create: {
      userId: staff.id,
      secret,
      backupCodes: JSON.stringify(backupCodes),
      verified: false,
    },
    update: {
      secret,
      backupCodes: JSON.stringify(backupCodes),
      verified: false,
      failedVerificationCount: 0,
      lockedUntil: null,
    },
  });

  const encodedIssuer = encodeURIComponent("Chawan Farms");
  const encodedEmail = encodeURIComponent(session.user.email);
  const totpURI = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

  return ok({ totpURI, secret, backupCodes });
}

export async function verifyTwoFactorSetupAction(rawInput: unknown): Promise<Result<{ enabled: true }>> {
  const staff = await requireStaff();
  const parsed = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Must be a 6-digit code") }).safeParse(rawInput);
  if (!parsed.success) return validationError();

  const twoFactor = await db.twoFactor.findUnique({
    where: { userId: staff.id },
  });

  if (!twoFactor) {
    return err("NOT_FOUND", "Two-factor setup has not been started.");
  }

  const otp = createOTP(twoFactor.secret, { period: 30, digits: 6 });
  const valid = await otp.verify(parsed.data.code, { window: 1 });

  if (!valid) {
    return err("VALIDATION", "Invalid verification code. Please check your authenticator app and try again.");
  }

  await db.$transaction(async (tx) => {
    await tx.twoFactor.update({
      where: { id: twoFactor.id },
      data: {
        verified: true,
        failedVerificationCount: 0,
        lockedUntil: null,
      },
    });

    await tx.user.update({
      where: { id: staff.id },
      data: {
        twoFactorEnabled: true,
      },
    });
  });

  await requestAudit(staff.id, "auth.two_factor.enabled", "User", staff.id, { twoFactorEnabled: false }, { twoFactorEnabled: true });

  return ok({ enabled: true });
}

export async function revokeOwnSessionAction(rawInput: unknown): Promise<Result<{ revoked: true; current: boolean }>> {
  const access = await authorizeStaff("staff.read");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const parsed = revokeSessionSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  const session = await getSession();
  if (!session || session.user.id !== actor.id) return err("UNAUTHENTICATED", "Please sign in again.");
  const target = await db.session.findFirst({
    where: { id: parsed.data.sessionId, userId: actor.id },
    select: { id: true, token: true },
  });
  if (!target) return err("NOT_FOUND", "Session not found.");
  const rate = await limit(`admin:session-revoke:${actor.id}`, 10, 3_600);
  if (!rate.allowed) return err("RATE_LIMITED", "Too many session revocations. Please try again later.");

  const current = matchesCurrentSessionToken(session.session.token, target.token);
  if (current) {
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch {
      return err("INTERNAL", "The current session could not be signed out.");
    }
  } else {
    const deleted = await db.session.deleteMany({ where: { id: target.id, userId: actor.id } });
    if (!deleted.count) return err("NOT_FOUND", "Session not found.");
  }
  const auditResult = await requestAudit(actor.id, "auth.session.revoke", "Session", parsed.data.sessionId, { active: true }, { active: false });
  return auditResult.ok ? ok({ revoked: true, current }) : auditResult;
}

export async function revokeAllOtherSessionsAction(): Promise<Result<{ revoked: number }>> {
  const access = await authorizeStaff("staff.read");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const session = await getSession();
  if (!session || session.user.id !== actor.id) return err("UNAUTHENTICATED", "Please sign in again.");

  const current = await db.session.findFirst({
    where: { userId: actor.id, token: session.session.token },
    select: { id: true },
  });
  if (!current) return err("UNAUTHENTICATED", "Please sign in again.");

  const rate = await limit(`admin:session-revoke:${actor.id}`, 10, 3_600);
  if (!rate.allowed) return err("RATE_LIMITED", "Too many session revocations. Please try again later.");

  const deleted = await db.session.deleteMany({
    where: { userId: actor.id, id: { not: current.id }, expiresAt: { gt: new Date() } },
  });
  const auditResult = await requestAudit(actor.id, "auth.sessions.revoke_others", "Session", "other-sessions", { activeOtherSessions: deleted.count }, { activeOtherSessions: 0 });
  return auditResult.ok ? ok({ revoked: deleted.count }) : auditResult;
}
