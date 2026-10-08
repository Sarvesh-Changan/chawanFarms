"use server";

import { createHash, randomBytes } from "node:crypto";

import { headers } from "next/headers";
import { z } from "zod";

import { env } from "@/config/env";
import { err, ok, type Result } from "@/lib/result";
import { auth, getSession } from "@/server/auth";
import { assertSafeStaffRoleChange, requirePermission, type StaffPrincipal } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { db } from "@/server/db";
import { sendStaffInviteEmail } from "@/server/integrations/email";
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
const changeRolesSchema = z.object({ targetUserId: uuidSchema, roleIds: z.array(uuidSchema).max(20).refine((items) => new Set(items).size === items.length) }).strict();
const disableStaffSchema = z.object({ targetUserId: uuidSchema }).strict();
const acceptInviteSchema = z.object({ token: tokenSchema, email: z.string().trim().email().max(254).optional(), name: z.string().trim().min(1).max(120).optional(), password: z.string().min(10).max(128).optional(), turnstileToken: z.string().max(2048).optional() }).strict().superRefine((input, context) => {
  if (input.password && !input.email) context.addIssue({ code: "custom", message: "Email is required when creating an account." });
  if (input.password && !input.name) context.addIssue({ code: "custom", message: "Name is required when creating an account." });
});
const totpSetupSchema = z.object({ password: z.string().min(1).max(128) }).strict();
const totpVerifySchema = z.object({ code: z.string().regex(/^\d{6,8}$/) }).strict();
const revokeSessionSchema = z.object({ sessionId: uuidSchema }).strict();

function validationError(): Result<never> {
  return err("VALIDATION", "Please check the submitted details.");
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
      const created = await auth.api.signUpEmail({
        body: { name: parsed.data.name, email, password: parsed.data.password, callbackURL: "/verify-email" },
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

export async function changeStaffRolesAction(rawInput: unknown): Promise<Result<{ updated: true }>> {
  const access = await authorizeStaff("staff.write");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const roleAccess = await authorizeStaff("roles.write");
  if (!roleAccess.ok) return err(roleAccess.error.code, roleAccess.error.message);
  const parsed = changeRolesSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  if (actor.id === parsed.data.targetUserId) return err("FORBIDDEN", "You cannot change your own access.");

  try {
    const beforeAndAfter = await db.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: parsed.data.targetUserId },
        select: { id: true, type: true, staffRoles: { select: { roleId: true, role: { select: { name: true } } } } },
      });
      if (!target || target.type !== "STAFF") throw new AuthorizationError("NOT_FOUND", "Staff member not found.");
      const nextRoles = await transaction.role.findMany({ where: { id: { in: parsed.data.roleIds } }, select: { id: true, name: true } });
      if (nextRoles.length !== parsed.data.roleIds.length) throw new AuthorizationError("VALIDATION", "One or more roles are unavailable.");
      const superAdminCount = await transaction.staffRole.count({ where: { role: { name: "Super Admin" }, user: { status: "ACTIVE", type: "STAFF" } } });
      const oldRoleNames = target.staffRoles.map(({ role }) => role.name);
      const newRoleNames = nextRoles.map(({ name }) => name);
      assertSafeStaffRoleChange({ actorId: actor.id, targetUserId: target.id, currentTargetRoles: oldRoleNames, nextTargetRoles: newRoleNames, currentSuperAdminCount: superAdminCount });
      await transaction.staffRole.deleteMany({ where: { userId: target.id } });
      if (nextRoles.length) await transaction.staffRole.createMany({ data: nextRoles.map(({ id }) => ({ userId: target.id, roleId: id, assignedById: actor.id })) });
      const sessionsRevoked = await transaction.session.deleteMany({ where: { userId: target.id } });
      return { before: oldRoleNames, after: newRoleNames, sessionsRevoked: sessionsRevoked.count };
    }, { isolationLevel: "Serializable" });
    const auditResult = await requestAudit(actor.id, "staff.roles.update", "User", parsed.data.targetUserId, beforeAndAfter.before, { roles: beforeAndAfter.after, sessionsRevoked: beforeAndAfter.sessionsRevoked });
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

  try {
    const result = await db.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id: parsed.data.targetUserId }, select: { id: true, status: true, type: true, staffRoles: { select: { role: { select: { name: true } } } } } });
      if (!target || target.type !== "STAFF") throw new AuthorizationError("NOT_FOUND", "Staff member not found.");
      const wasSuperAdmin = target.staffRoles.some(({ role }) => role.name === "Super Admin");
      if (wasSuperAdmin) {
        const activeSuperAdmins = await transaction.staffRole.count({ where: { role: { name: "Super Admin" }, user: { type: "STAFF", status: "ACTIVE" } } });
        if (activeSuperAdmins <= 1) throw new AuthorizationError("CONFLICT", "The last active Super Admin cannot be disabled.");
      }
      const revokedSessions = await transaction.session.deleteMany({ where: { userId: target.id } });
      await transaction.user.update({ where: { id: target.id }, data: { status: "SUSPENDED" } });
      return { beforeStatus: target.status, revokedSessions: revokedSessions.count };
    }, { isolationLevel: "Serializable" });
    const auditResult = await requestAudit(actor.id, "staff.disable", "User", parsed.data.targetUserId, { status: result.beforeStatus }, { status: "SUSPENDED", revokedSessions: result.revokedSessions });
    return auditResult.ok ? ok({ disabled: true }) : auditResult;
  } catch (error) {
    if (error instanceof AuthorizationError) return err(error.code, error.message);
    return err("CONFLICT", "The staff account could not be disabled.");
  }
}

export async function startTwoFactorSetupAction(rawInput: unknown): Promise<Result<{ totpURI: string; backupCodes: string[] }>> {
  const access = await authorizeStaff("staff.read", { allowTwoFactorSetup: true });
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const parsed = totpSetupSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  try {
    const result = await auth.api.enableTwoFactor({ body: { password: parsed.data.password, method: "totp" }, headers: await headers() });
    if (result.method !== "totp") return err("INTERNAL", "TOTP setup is unavailable.");
    const auditResult = await requestAudit(actor.id, "auth.2fa.setup.started", "User", actor.id, { enabled: false }, { setupStarted: true });
    return auditResult.ok ? ok({ totpURI: result.totpURI, backupCodes: result.backupCodes }) : auditResult;
  } catch {
    return err("FORBIDDEN", "Unable to start two-factor setup. Confirm your password and try again.");
  }
}

export async function verifyTwoFactorSetupAction(rawInput: unknown): Promise<Result<{ enabled: true }>> {
  const access = await authorizeStaff("staff.read", { allowTwoFactorSetup: true });
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const parsed = totpVerifySchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  try {
    await auth.api.verifyTOTP({ body: { code: parsed.data.code }, headers: await headers() });
    const auditResult = await requestAudit(actor.id, "auth.2fa.enabled", "User", actor.id, { enabled: false }, { enabled: true });
    return auditResult.ok ? ok({ enabled: true }) : auditResult;
  } catch {
    return err("VALIDATION", "That authenticator code could not be verified.");
  }
}

export async function revokeOwnSessionAction(rawInput: unknown): Promise<Result<{ revoked: true }>> {
  const access = await authorizeStaff("staff.read");
  if (!access.ok) return err(access.error.code, access.error.message);
  const actor = access.data;
  const parsed = revokeSessionSchema.safeParse(rawInput);
  if (!parsed.success) return validationError();
  const session = await getSession();
  if (!session || session.user.id !== actor.id) return err("UNAUTHENTICATED", "Please sign in again.");
  const deleted = await db.session.deleteMany({ where: { id: parsed.data.sessionId, userId: actor.id } });
  if (!deleted.count) return err("NOT_FOUND", "Session not found.");
  const auditResult = await requestAudit(actor.id, "auth.session.revoke", "Session", parsed.data.sessionId, { active: true }, { active: false });
  return auditResult.ok ? ok({ revoked: true }) : auditResult;
}
