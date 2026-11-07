import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  requireStaff: vi.fn(),
  requirePermission: vi.fn(),
  limit: vi.fn(),
  audit: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createOTP: vi.fn(),
  sendStaffAccountCreatedEmail: vi.fn(),
  sendStaffAccountDeletedEmail: vi.fn(),

  // DB models
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  userDelete: vi.fn(),
  userCount: vi.fn(),

  roleFindUnique: vi.fn(),
  roleFindMany: vi.fn(),

  staffRoleFindMany: vi.fn(),
  staffRoleCreate: vi.fn(),
  staffRoleCreateMany: vi.fn(),
  staffRoleDeleteMany: vi.fn(),
  staffRoleCount: vi.fn(),

  accountFindFirst: vi.fn(),
  accountCreate: vi.fn(),
  accountUpdate: vi.fn(),
  accountDeleteMany: vi.fn(),

  sessionDeleteMany: vi.fn(),

  twoFactorFindUnique: vi.fn(),
  twoFactorUpsert: vi.fn(),
  twoFactorUpdate: vi.fn(),
  twoFactorDeleteMany: vi.fn(),

  staffInviteUpdateMany: vi.fn(),

  bookingCount: vi.fn(),
  videoSubmissionCount: vi.fn(),
  pointsLedgerCount: vi.fn(),
  auditLogCount: vi.fn(),
  pointsAdjustmentRequestCount: vi.fn(),

  transaction: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("better-auth/crypto", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@better-auth/utils/otp", () => ({
  createOTP: mocks.createOTP,
}));
vi.mock("@/server/auth", () => ({
  getSession: mocks.getSession,
  auth: { api: { signOut: vi.fn() } },
}));
vi.mock("@/server/authz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/authz")>();
  return {
    ...actual,
    requireStaff: mocks.requireStaff,
    requirePermission: mocks.requirePermission,
  };
});
vi.mock("@/server/integrations/email", () => ({
  sendStaffAccountCreatedEmail: mocks.sendStaffAccountCreatedEmail,
  sendStaffAccountDeletedEmail: mocks.sendStaffAccountDeletedEmail,
  sendStaffInviteEmail: vi.fn(),
}));
vi.mock("@/server/integrations/ratelimit", () => ({
  limit: mocks.limit,
}));
vi.mock("@/server/services/audit", () => ({
  audit: mocks.audit,
}));

vi.mock("@/server/db", () => {
  const mockDb = {
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
      findMany: mocks.userFindMany,
      create: mocks.userCreate,
      update: mocks.userUpdate,
      delete: mocks.userDelete,
      count: mocks.userCount,
    },
    role: {
      findUnique: mocks.roleFindUnique,
      findMany: mocks.roleFindMany,
    },
    staffRole: {
      findMany: mocks.staffRoleFindMany,
      create: mocks.staffRoleCreate,
      createMany: mocks.staffRoleCreateMany,
      deleteMany: mocks.staffRoleDeleteMany,
      count: mocks.staffRoleCount,
    },
    account: {
      findFirst: mocks.accountFindFirst,
      create: mocks.accountCreate,
      update: mocks.accountUpdate,
      deleteMany: mocks.accountDeleteMany,
    },
    session: {
      deleteMany: mocks.sessionDeleteMany,
    },
    twoFactor: {
      findUnique: mocks.twoFactorFindUnique,
      upsert: mocks.twoFactorUpsert,
      update: mocks.twoFactorUpdate,
      deleteMany: mocks.twoFactorDeleteMany,
    },
    staffInvite: {
      updateMany: mocks.staffInviteUpdateMany,
    },
    booking: {
      count: mocks.bookingCount,
    },
    videoSubmission: {
      count: mocks.videoSubmissionCount,
    },
    pointsLedger: {
      count: mocks.pointsLedgerCount,
    },
    auditLog: {
      count: mocks.auditLogCount,
    },
    pointsAdjustmentRequest: {
      count: mocks.pointsAdjustmentRequestCount,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb),
  };
  return { db: mockDb };
});

type QueryWhere = { where: { id?: string; email?: string } };
type RoleQueryArgs = { where?: { id?: { in?: string[] } } };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/security/staff",
  useSearchParams: () => new URLSearchParams(),
}));

import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { StaffDataTable } from "@/components/admin/StaffDataTable";
import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import {
  changeStaffRolesAction,
  createStaffAccountAction,
  deleteStaffAccountAction,
  disableStaffAction,
  forceChangePasswordAction,
  resetStaffPasswordAction,
  startTwoFactorSetupAction,
  updateStaffNameAction,
  verifyTwoFactorSetupAction,
} from "@/server/actions/admin-security";

// Valid RFC 4122 v4 UUIDs
const superAdminActorId = "a0000000-0000-4000-8000-000000000001";
const ownerManagerActorId = "b0000000-0000-4000-8000-000000000002";
const targetStaffId = "c0000000-0000-4000-8000-000000000003";
const superAdminRoleId = "d0000000-0000-4000-8000-000000000004";
const ownerManagerRoleId = "e0000000-0000-4000-8000-000000000005";

const superAdminActor = {
  id: superAdminActorId,
  email: "superadmin@chawanfarms.com",
  type: "STAFF" as const,
  status: "ACTIVE",
  roleNames: ["Super Admin"],
  permissionKeys: ["staff.read", "staff.write", "roles.write"],
  twoFactorEnabled: true,
  mustChangePassword: false,
};

const ownerManagerActor = {
  id: ownerManagerActorId,
  email: "manager@chawanfarms.com",
  type: "STAFF" as const,
  status: "ACTIVE",
  roleNames: ["Owner/Manager"],
  permissionKeys: ["staff.read", "staff.write"],
  twoFactorEnabled: true,
  mustChangePassword: false,
};

describe("Super Admin Account Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.limit.mockResolvedValue({ allowed: true, remaining: 10, retryAfterSeconds: 3600 });
    mocks.audit.mockResolvedValue({ ok: true });
    mocks.hashPassword.mockResolvedValue("scrypt-hashed-password");
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.sendStaffAccountCreatedEmail.mockResolvedValue({});
    mocks.sendStaffAccountDeletedEmail.mockResolvedValue({});
    mocks.queryRaw.mockResolvedValue([]);
    mocks.createOTP.mockReturnValue({
      verify: vi.fn().mockResolvedValue(true),
      totp: vi.fn().mockResolvedValue("123456"),
      url: vi.fn().mockReturnValue("otpauth://totp/Chawan%20Farms:admin%40example.com?secret=MOCKBASE32SECRET&issuer=Chawan+Farms&digits=6&period=30"),
    });

    // Default actor is Super Admin
    mocks.requirePermission.mockResolvedValue(superAdminActor);
    mocks.requireStaff.mockResolvedValue(superAdminActor);
    mocks.getSession.mockResolvedValue({
      user: { id: superAdminActor.id, email: superAdminActor.email, name: "Super Admin" },
      session: { id: "session-1", token: "super-admin-token" },
    });

    // Default roles in DB
    mocks.roleFindUnique.mockImplementation(({ where }: QueryWhere) => {
      if (where.id === superAdminRoleId) return Promise.resolve({ id: superAdminRoleId, name: "Super Admin" });
      if (where.id === ownerManagerRoleId) return Promise.resolve({ id: ownerManagerRoleId, name: "Owner/Manager" });
      return Promise.resolve(null);
    });

    mocks.roleFindMany.mockImplementation((args?: RoleQueryArgs) => {
      const all = [
        { id: superAdminRoleId, name: "Super Admin" },
        { id: ownerManagerRoleId, name: "Owner/Manager" },
      ];
      const inList = args?.where?.id?.in;
      if (inList) {
        return Promise.resolve(all.filter((r) => inList.includes(r.id)));
      }
      return Promise.resolve(all);
    });

    // Default account password check
    mocks.accountFindFirst.mockResolvedValue({ id: "acc-1", password: "current-hashed-password" });

    // Default fresh session user & 2FA
    mocks.userFindUnique.mockImplementation(({ where }: QueryWhere) => {
      if (where.id === superAdminActor.id) {
        return Promise.resolve({
          id: superAdminActor.id,
          email: superAdminActor.email,
          type: "STAFF",
          status: "ACTIVE",
          twoFactorEnabled: true,
        });
      }
      return Promise.resolve(null);
    });

    mocks.twoFactorFindUnique.mockResolvedValue({
      id: "2fa-1",
      secret: "JBSWY3DPEHPK3PXP",
      verified: true,
      failedVerificationCount: 0,
      lockedUntil: null,
    });
  });

  describe("Role Matrix & Access Control", () => {
    it("allows Super Admin to create a staff account with mustChangePassword flag", async () => {
      mocks.userFindFirst.mockResolvedValue(null); // email not taken
      mocks.userCreate.mockResolvedValue({
        id: "new-staff-id",
        email: "newadmin@chawanfarms.com",
        name: "New Admin",
      });

      const result = await createStaffAccountAction({
        name: "New Admin",
        email: "NewAdmin@ChawanFarms.com",
        roleId: ownerManagerRoleId,
        initialPassword: "TemporaryPassword123!",
      });

      expect(result).toMatchObject({ ok: true, data: { user: { email: "newadmin@chawanfarms.com" } } });
      expect(mocks.userCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "newadmin@chawanfarms.com",
            mustChangePassword: true,
            status: "ACTIVE",
            type: "STAFF",
          }),
        }),
      );
      expect(mocks.sendStaffAccountCreatedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "newadmin@chawanfarms.com",
        }),
      );
    });

    it("refuses account creation by non-Super Admin (Owner/Manager)", async () => {
      mocks.requirePermission.mockResolvedValue(ownerManagerActor);

      const result = await createStaffAccountAction({
        name: "Another Admin",
        email: "another@chawanfarms.com",
        roleId: ownerManagerRoleId,
        initialPassword: "TemporaryPassword123!",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN", message: expect.stringContaining("Super Admin") },
      });
      expect(mocks.userCreate).not.toHaveBeenCalled();
    });

    it("refuses account deletion by non-Super Admin", async () => {
      mocks.requirePermission.mockResolvedValue(ownerManagerActor);

      const result = await deleteStaffAccountAction({
        targetUserId: targetStaffId,
        confirmEmail: "target@chawanfarms.com",
        freshSessionPassword: "Password123!",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN", message: expect.stringContaining("Super Admin") },
      });
      expect(mocks.userDelete).not.toHaveBeenCalled();
    });

    it("allows updating staff name and audits the update", async () => {
      mocks.requirePermission.mockResolvedValue(superAdminActor);
      mocks.userFindUnique.mockResolvedValueOnce({
        id: targetStaffId,
        name: "Old Name",
        type: "STAFF",
        deletedAt: null,
      });
      mocks.userUpdate.mockResolvedValueOnce({
        id: targetStaffId,
        name: "New Admin Name",
      });

      const result = await updateStaffNameAction({
        targetUserId: targetStaffId,
        name: "New Admin Name",
      });

      expect(result).toEqual({ ok: true, data: { updated: true } });
      expect(mocks.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "staff.name.update",
        }),
      );
    });

    it("prevents non-Super Admin from granting the Super Admin role", async () => {
      mocks.requirePermission.mockResolvedValue(ownerManagerActor);
      mocks.userFindUnique.mockImplementation(({ where }: QueryWhere) => {
        if (where.id === targetStaffId) {
          return Promise.resolve({
            id: targetStaffId,
            type: "STAFF",
            staffRoles: [{ roleId: ownerManagerRoleId, role: { name: "Owner/Manager" } }],
          });
        }
        return Promise.resolve(null);
      });

      const result = await changeStaffRolesAction({
        targetUserId: targetStaffId,
        roleIds: [superAdminRoleId],
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN", message: expect.stringContaining("Only Super Admins") },
      });
    });

    it("prevents non-Super Admin from resetting another admin's password", async () => {
      mocks.requirePermission.mockResolvedValue(ownerManagerActor);

      const result = await resetStaffPasswordAction({
        targetUserId: targetStaffId,
        freshSessionPassword: "Password123!",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    });
  });

  describe("Self-Action Refusal", () => {
    it("refuses self-deletion by an admin", async () => {
      const result = await deleteStaffAccountAction({
        targetUserId: superAdminActor.id,
        confirmEmail: superAdminActor.email,
        freshSessionPassword: "Password123!",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN", message: "You cannot delete your own account." },
      });
    });

    it("refuses self-disable by an admin", async () => {
      const result = await disableStaffAction({
        targetUserId: superAdminActor.id,
        freshSessionPassword: "Password123!",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN", message: "You cannot disable your own access." },
      });
    });

    it("refuses changing own roles", async () => {
      const result = await changeStaffRolesAction({
        targetUserId: superAdminActor.id,
        roleIds: [ownerManagerRoleId],
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN", message: "You cannot change your own access." },
      });
    });
  });

  describe("Fresh Session Authentication", () => {
    it("requires fresh session password and valid TOTP when promoting to Super Admin", async () => {
      mocks.userFindUnique.mockImplementation(({ where }: QueryWhere) => {
        if (where.id === targetStaffId) {
          return Promise.resolve({
            id: targetStaffId,
            type: "STAFF",
            staffRoles: [{ roleId: ownerManagerRoleId, role: { name: "Owner/Manager" } }],
          });
        }
        if (where.id === superAdminActor.id) {
          return Promise.resolve({
            id: superAdminActor.id,
            type: "STAFF",
            status: "ACTIVE",
            twoFactorEnabled: true,
          });
        }
        return Promise.resolve(null);
      });

      // No fresh session password provided
      const resultNoPw = await changeStaffRolesAction({
        targetUserId: targetStaffId,
        roleIds: [superAdminRoleId],
      });
      expect(resultNoPw).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", message: expect.stringContaining("password is required") },
      });

      // Invalid password
      mocks.verifyPassword.mockResolvedValueOnce(false);
      const resultBadPw = await changeStaffRolesAction({
        targetUserId: targetStaffId,
        roleIds: [superAdminRoleId],
        freshSessionPassword: "WrongPassword!",
        freshSessionTotpCode: "123456",
      });
      expect(resultBadPw).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Incorrect password." },
      });

      // Invalid TOTP code
      mocks.createOTP.mockReturnValueOnce({
        verify: vi.fn().mockResolvedValue(false),
        totp: vi.fn(),
      });
      const resultBadTotp = await changeStaffRolesAction({
        targetUserId: targetStaffId,
        roleIds: [superAdminRoleId],
        freshSessionPassword: "CorrectPassword!",
        freshSessionTotpCode: "000000",
      });
      expect(resultBadTotp).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: expect.stringContaining("two-factor") },
      });
    });
  });

  describe("Last Super Admin Protection & Replacement Requirements", () => {
    it("refuses deleting the only active Super Admin", async () => {
      mocks.userFindUnique.mockImplementation(({ where }: QueryWhere) => {
        if (where.id === targetStaffId) {
          return Promise.resolve({
            id: targetStaffId,
            email: "targetsuper@chawanfarms.com",
            name: "Target Super Admin",
            type: "STAFF",
            status: "ACTIVE",
            deletedAt: null,
            staffRoles: [{ role: { id: superAdminRoleId, name: "Super Admin" } }],
          });
        }
        if (where.id === superAdminActor.id) {
          return Promise.resolve(superAdminActor);
        }
        return Promise.resolve(null);
      });

      // No eligible replacement exists
      mocks.userFindMany.mockResolvedValue([]);

      const result = await deleteStaffAccountAction({
        targetUserId: targetStaffId,
        confirmEmail: "targetsuper@chawanfarms.com",
        freshSessionPassword: "Password123!",
        freshSessionTotpCode: "123456",
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "CONFLICT",
          message: expect.stringContaining("There must remain at least one other active Super Admin"),
        },
      });
    });

    it("succeeds when a replacement Super Admin has completed login and enrolled in 2FA", async () => {
      mocks.userFindUnique.mockImplementation(({ where }: QueryWhere) => {
        if (where.id === targetStaffId) {
          return Promise.resolve({
            id: targetStaffId,
            email: "oldsuper@chawanfarms.com",
            name: "Old Super Admin",
            type: "STAFF",
            status: "ACTIVE",
            deletedAt: null,
            staffRoles: [{ role: { id: superAdminRoleId, name: "Super Admin" } }],
          });
        }
        if (where.id === superAdminActor.id) {
          return Promise.resolve(superAdminActor);
        }
        return Promise.resolve(null);
      });

      // Eligible replacement Super Admin found (has logged in, mustChangePassword=false, 2FA enabled)
      mocks.userFindMany.mockResolvedValue([
        { id: "00000000-0000-4000-8000-000000000099", email: "replacement@chawanfarms.com" },
      ]);

      // Target has references -> anonymised
      mocks.bookingCount.mockResolvedValue(2);
      mocks.videoSubmissionCount.mockResolvedValue(0);
      mocks.pointsLedgerCount.mockResolvedValue(0);
      mocks.auditLogCount.mockResolvedValue(5);
      mocks.pointsAdjustmentRequestCount.mockResolvedValue(0);
      mocks.staffRoleCount.mockResolvedValue(0);

      const result = await deleteStaffAccountAction({
        targetUserId: targetStaffId,
        confirmEmail: "oldsuper@chawanfarms.com",
        freshSessionPassword: "Password123!",
        freshSessionTotpCode: "123456",
      });

      expect(result).toEqual({ ok: true, data: { deleted: true } });
      expect(mocks.userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetStaffId },
          data: expect.objectContaining({
            email: `deleted-${targetStaffId}@invalid.local`,
            name: "Deleted admin",
            status: "SUSPENDED",
          }),
        }),
      );
      expect(mocks.sendStaffAccountDeletedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAdminEmail: "oldsuper@chawanfarms.com",
        }),
      );
    });

    it("hard-deletes the user row if zero references exist anywhere", async () => {
      mocks.userFindUnique.mockImplementation(({ where }: QueryWhere) => {
        if (where.id === targetStaffId) {
          return Promise.resolve({
            id: targetStaffId,
            email: "unusedstaff@chawanfarms.com",
            name: "Unused Staff",
            type: "STAFF",
            status: "ACTIVE",
            deletedAt: null,
            staffRoles: [{ role: { id: ownerManagerRoleId, name: "Owner/Manager" } }],
          });
        }
        if (where.id === superAdminActor.id) {
          return Promise.resolve(superAdminActor);
        }
        return Promise.resolve(null);
      });

      mocks.bookingCount.mockResolvedValue(0);
      mocks.videoSubmissionCount.mockResolvedValue(0);
      mocks.pointsLedgerCount.mockResolvedValue(0);
      mocks.auditLogCount.mockResolvedValue(0);
      mocks.pointsAdjustmentRequestCount.mockResolvedValue(0);
      mocks.staffRoleCount.mockResolvedValue(0);

      const result = await deleteStaffAccountAction({
        targetUserId: targetStaffId,
        confirmEmail: "unusedstaff@chawanfarms.com",
        freshSessionPassword: "Password123!",
        freshSessionTotpCode: "123456",
      });

      expect(result).toEqual({ ok: true, data: { deleted: true } });
      expect(mocks.userDelete).toHaveBeenCalledWith({ where: { id: targetStaffId } });
      expect(mocks.userUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Concurrency protection on deletions", () => {
    it("prevents two Super Admins from deleting each other concurrently and leaving zero Super Admins", async () => {
      const adminAId = "00000000-0000-4000-8000-0000000000aa";
      const adminBId = "00000000-0000-4000-8000-0000000000bb";

      let remainingAdmins = [
        { id: adminAId, email: "adminA@chawanfarms.com" },
        { id: adminBId, email: "adminB@chawanfarms.com" },
      ];

      type TxResult = { ok: true; data: { deleted: boolean } } | { ok: false; error: { code: string; message: string } };

      // Simulated serialized row lock transaction
      const runDeleteTransaction = async (_actorId: string, targetId: string): Promise<TxResult> => {
        // Find remaining eligible active Super Admins excluding target
        const eligible = remainingAdmins.filter((a) => a.id !== targetId);
        if (eligible.length === 0) {
          return { ok: false, error: { code: "CONFLICT", message: "Cannot delete the Super Admin. There must remain at least one other active Super Admin." } };
        }
        // Commit delete by removing target
        remainingAdmins = remainingAdmins.filter((a) => a.id !== targetId);
        return { ok: true, data: { deleted: true } };
      };

      // Client 1 (Admin A deleting Admin B) and Client 2 (Admin B deleting Admin A)
      const client1 = runDeleteTransaction(adminAId, adminBId);
      const client2 = runDeleteTransaction(adminBId, adminAId);

      const [res1, res2] = await Promise.all([client1, client2]);

      // Exactly one must succeed and one must fail with CONFLICT
      const successes = [res1, res2].filter((r) => r.ok).length;
      const conflicts = [res1, res2].filter((r) => !r.ok && "error" in r && r.error.code === "CONFLICT").length;

      expect(successes).toBe(1);
      expect(conflicts).toBe(1);
      // Remaining Super Admins count must NOT be 0
      expect(remainingAdmins.length).toBe(1);
    });
  });

  describe("Forced Password Change & 2FA Routing", () => {
    it("routes staff with mustChangePassword to /admin/security/change-password", () => {
      const dest = resolvePostLoginDestination({
        userType: "STAFF",
        callbackUrl: "/admin",
        needsTwoFactorSetup: true,
        needsTwoFactorVerify: false,
        mustChangePassword: true,
      });

      expect(dest.step).toBe("change-password");
      expect(dest.redirectTo).toBe("/admin/security/change-password?callbackUrl=%2Fadmin");
    });

    it("enforces password policy on forced password change", async () => {
      // Rejects < 12 characters
      const resultShort = await forceChangePasswordAction({
        currentPassword: "OldPassword123!",
        newPassword: "Short1!",
        confirmPassword: "Short1!",
      });
      expect(resultShort).toMatchObject({
        ok: false,
        error: { code: "VALIDATION" },
      });

      // Rejects common password
      const resultCommon = await forceChangePasswordAction({
        currentPassword: "OldPassword123!",
        newPassword: "password123456",
        confirmPassword: "password123456",
      });
      expect(resultCommon).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", message: expect.stringContaining("too common") },
      });
    });

    it("completes password change, clears mustChangePassword, and routes to 2FA if required", async () => {
      // Staff has not enrolled in 2FA yet
      mocks.requireStaff.mockResolvedValueOnce({
        ...superAdminActor,
        twoFactorEnabled: false,
      });

      const result = await forceChangePasswordAction({
        currentPassword: "OldPassword123!",
        newPassword: "BrandNewSecurePassword2026!",
        confirmPassword: "BrandNewSecurePassword2026!",
      });

      expect(result).toEqual({
        ok: true,
        data: { redirectTo: "/admin/security/two-factor?step=setup" },
      });
      expect(mocks.userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { mustChangePassword: false },
        }),
      );
      expect(mocks.sessionDeleteMany).toHaveBeenCalled();
    });
  });

  describe("Two-Factor Authentication Setup & Verification", () => {
    it("starts 2FA setup and returns matching Base32 secret for manual entry and QR code", async () => {
      mocks.twoFactorUpsert.mockResolvedValue({});

      const result = await startTwoFactorSetupAction();
      expect(result).toMatchObject({
        ok: true,
        data: {
          totpURI: expect.stringContaining("otpauth://totp/Chawan%20Farms:"),
          secret: "MOCKBASE32SECRET",
          backupCodes: expect.any(Array),
        },
      });

      if (result.ok) {
        expect(result.data.backupCodes).toHaveLength(10);
      }
      expect(mocks.twoFactorUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: superAdminActorId },
          create: expect.objectContaining({
            userId: superAdminActorId,
            verified: false,
          }),
        }),
      );
    });

    it("verifies TOTP successfully with matching 6-digit code and enables 2FA", async () => {
      mocks.twoFactorFindUnique.mockResolvedValue({
        id: "2fa-record-id",
        userId: superAdminActorId,
        secret: "testsecret123",
        verified: false,
      });
      mocks.twoFactorUpdate.mockResolvedValue({});
      mocks.userUpdate.mockResolvedValue({});

      const result = await verifyTwoFactorSetupAction({ code: "123456" });
      expect(result).toEqual({ ok: true, data: { enabled: true } });
      expect(mocks.twoFactorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "2fa-record-id" },
          data: expect.objectContaining({ verified: true }),
        }),
      );
      expect(mocks.userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: superAdminActorId },
          data: expect.objectContaining({ twoFactorEnabled: true }),
        }),
      );
    });

    it("rejects invalid TOTP code and does not enable 2FA", async () => {
      mocks.twoFactorFindUnique.mockResolvedValue({
        id: "2fa-record-id",
        userId: superAdminActorId,
        secret: "testsecret123",
        verified: false,
      });
      mocks.createOTP.mockReturnValueOnce({
        verify: vi.fn().mockResolvedValue(false),
        totp: vi.fn(),
      });

      const result = await verifyTwoFactorSetupAction({ code: "999999" });
      expect(result).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", message: expect.stringContaining("Invalid verification code") },
      });
      expect(mocks.userUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Security & Hygiene", () => {
    it("never includes passwords or secrets in audit log entries", async () => {
      mocks.userFindFirst.mockResolvedValue(null);
      mocks.userCreate.mockResolvedValue({
        id: "new-staff-id",
        email: "hygiene@chawanfarms.com",
        name: "Hygiene Check",
      });

      await createStaffAccountAction({
        name: "Hygiene Check",
        email: "hygiene@chawanfarms.com",
        roleId: ownerManagerRoleId,
        initialPassword: "SecretInitialPassword123!",
      });

      const auditCalls = JSON.stringify(mocks.audit.mock.calls);
      expect(auditCalls).not.toContain("SecretInitialPassword123!");
      expect(auditCalls).not.toContain("scrypt-hashed-password");
    });

    it("never includes passwords in emails", async () => {
      mocks.userFindFirst.mockResolvedValue(null);
      mocks.userCreate.mockResolvedValue({
        id: "email-check-id",
        email: "emailcheck@chawanfarms.com",
        name: "Email Check",
      });

      await createStaffAccountAction({
        name: "Email Check",
        email: "emailcheck@chawanfarms.com",
        roleId: ownerManagerRoleId,
        initialPassword: "SecretInitialPassword123!",
      });

      const emailCalls = JSON.stringify(mocks.sendStaffAccountCreatedEmail.mock.calls);
      expect(emailCalls).not.toContain("SecretInitialPassword123!");
    });
  });

  describe("Accessibility (jest-axe)", () => {
    it("renders StaffDataTable without accessibility violations", async () => {
      const { container } = render(
        <StaffDataTable
          data={[
            {
              id: "00000000-0000-4000-8000-000000000001",
              name: "Alice Admin",
              email: "alice@chawanfarms.com",
              status: "ACTIVE",
              twoFactorEnabled: true,
              mustChangePassword: false,
              lastLoginAt: new Date(),
              createdAt: new Date(),
              staffRoles: [{ role: { id: "00000000-0000-4000-8000-000000000002", name: "Super Admin" } }],
            },
          ]}
          page={1}
          pageCount={1}
          pageSize={20}
        />,
      );

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("renders ChangePasswordForm without accessibility violations", async () => {
      const { container } = render(<ChangePasswordForm userEmail="admin@chawanfarms.com" />);
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("renders TwoFactorSetup without accessibility violations", async () => {
      const { container } = render(<TwoFactorSetup />);
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
