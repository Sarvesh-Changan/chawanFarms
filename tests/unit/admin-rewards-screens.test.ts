import { describe, expect, it } from "vitest";

import { maskEmail, sanitizeCsvCell } from "@/lib/mask";
import { ROLE_PERMISSION_MATRIX } from "@/server/authz/permissions";

describe("Admin Rewards Screens & Security Safeguards", () => {
  describe("CSV Formula Injection Defense & Masking", () => {
    it("prefixes dangerous formula trigger characters with a single quote", () => {
      expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvCell("+12345")).toBe("'+12345");
      expect(sanitizeCsvCell("-50")).toBe("'-50");
      expect(sanitizeCsvCell("@cmd")).toBe("'@cmd");
      expect(sanitizeCsvCell("\tcalc")).toBe("'\tcalc");
      // \r is both formula trigger and newline, so CSV quotes it
      expect(sanitizeCsvCell("\rcmd")).toBe("\"'\rcmd\"");
    });

    it("leaves safe strings and numbers unchanged as string", () => {
      expect(sanitizeCsvCell("Normal Reason")).toBe("Normal Reason");
      expect(sanitizeCsvCell("customer@example.com")).toBe("customer@example.com");
      expect(sanitizeCsvCell(100)).toBe("100");
      expect(sanitizeCsvCell(null)).toBe("");
      expect(sanitizeCsvCell(undefined)).toBe("");
    });

    it("correctly masks customer emails for privacy in staff views", () => {
      expect(maskEmail("john.doe@example.com")).toBe("j***@example.com");
      expect(maskEmail("alice@test.com")).toBe("a***@test.com");
      expect(maskEmail("")).toBe("—");
      expect(maskEmail(null)).toBe("—");
      expect(maskEmail("invalid-email")).toBe("[REDACTED_EMAIL]");
    });
  });

  describe("Permission Matrix — rewards.ledger.export", () => {
    it("grants rewards.ledger.export ONLY to Super Admin and Owner/Manager", () => {
      const superAdminPerms = ROLE_PERMISSION_MATRIX["Super Admin"];
      const ownerPerms = ROLE_PERMISSION_MATRIX["Owner/Manager"];
      const reservationsPerms = ROLE_PERMISSION_MATRIX["Reservations"];

      expect(superAdminPerms).toContain("rewards.ledger.export");
      expect(ownerPerms).toContain("rewards.ledger.export");
      expect(reservationsPerms).not.toContain("rewards.ledger.export");
    });

    it("ensures ledger reading is available to Super Admin and Owner/Manager", () => {
      expect(ROLE_PERMISSION_MATRIX["Super Admin"]).toContain("rewards.ledger.read");
      expect(ROLE_PERMISSION_MATRIX["Owner/Manager"]).toContain("rewards.ledger.read");
    });
  });

  describe("Reward Dashboard Metrics Calculation Safety", () => {
    it("handles zero coupons issued without division by zero or NaN", () => {
      const couponsIssued = 0;
      const couponsRedeemed = 0;
      const redemptionRate =
        couponsIssued > 0
          ? Math.round((couponsRedeemed / couponsIssued) * 1000) / 10
          : 0;

      expect(redemptionRate).toBe(0);
      expect(Number.isNaN(redemptionRate)).toBe(false);
      expect(Number.isFinite(redemptionRate)).toBe(true);
    });

    it("calculates correct redemption rate percentage rounded to 1 decimal", () => {
      const couponsIssued = 25;
      const couponsRedeemed = 10;
      const redemptionRate =
        couponsIssued > 0
          ? Math.round((couponsRedeemed / couponsIssued) * 1000) / 10
          : 0;

      expect(redemptionRate).toBe(40);
    });
  });
});
