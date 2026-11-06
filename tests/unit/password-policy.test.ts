import { describe, expect, it } from "vitest";

import { validateAdminPassword } from "@/lib/auth/password-policy";

describe("Admin password policy validation", () => {
  it("rejects passwords shorter than 12 characters", () => {
    const result = validateAdminPassword("Short1!", "admin@chawanfarms.com");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("at least 12 characters");
    }
  });

  it("rejects passwords longer than 128 characters", () => {
    const longPassword = "a".repeat(129);
    const result = validateAdminPassword(longPassword, "admin@chawanfarms.com");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("at most 128 characters");
    }
  });

  it("rejects common passwords from the top-1,000 dictionary", () => {
    const result = validateAdminPassword("password1234", "admin@chawanfarms.com");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("too common");
    }
  });

  it("rejects passwords containing the email local part (case-insensitive)", () => {
    const result = validateAdminPassword("ChawanFarms123SecretKey!", "chawanfarms123@gmail.com");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("email username or local part");
    }
  });

  it("accepts strong passwords containing spaces and Unicode", () => {
    const result = validateAdminPassword("सत्यमेव जयते correct horse battery", "operator@example.com");
    expect(result.valid).toBe(true);
  });
});

