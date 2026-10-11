import fs from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Ensures that reward engine service and policy files do NOT contain
 * hardcoded business constants (e.g. points per video, max points, expiry days,
 * approval threshold, tier costs). All such values must come from the database / active RewardRule.
 *
 * Allowed numeric literals:
 * - 0, 1, -1 (standard identity/signs/comparisons)
 * - 100 (percentage math / basis points / cents)
 * - 10, 12, 16, 32, 256 (hash/code generation lengths, base-32 alphabet size, byte sizing)
 * - 24, 60, 1000, 86400000, 86_400_000 (time constants: hours, minutes, ms per day)
 */
const ALLOWED_NUMBERS = new Set([
  0,
  1,
  -1,
  8, // slice length for referral code
  10,
  12,
  16,
  31, // 5-bit mask for base-32 alphabet (0b00011111)
  32,
  50, // integer half-up rounding (+ 50) / 100
  60,
  24,
  100,
  256,
  1000,
  86400000,
]);

// Specific forbidden business reward defaults if found as numeric literals
const FORBIDDEN_BUSINESS_NUMBERS = new Set([
  200, // provisional manualAdjustApprovalThreshold
  250, // provisional Tier 2 pointsCost
  365, // provisional pointExpiryDays
  500, // provisional maxPointsPerCustomer
  50000, // provisional tier maxDiscountPaise
  100000, // provisional tier maxDiscountPaise
  500000, // provisional minBookingPaise
  1000000, // provisional minBookingPaise
]);

function extractNumericLiterals(filePath: string): Array<{ value: number; line: number }> {
  const fullPath = path.resolve(process.cwd(), filePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const content = fs.readFileSync(fullPath, "utf-8");
  const sourceFile = ts.createSourceFile(
    fullPath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  const literals: Array<{ value: number; line: number }> = [];

  function visit(node: ts.Node) {
    if (ts.isNumericLiteral(node)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const numValue = Number(node.text.replace(/_/g, ""));
      literals.push({ value: numValue, line });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return literals;
}

describe("Rewards Engine - No Hardcoded Business Constants", () => {
  const filesToCheck = [
    "src/server/services/rewards.ts",
    "src/server/services/coupons.ts",
    "src/server/policies/rewardCaps.ts",
    "src/server/policies/couponEligibility.ts",
  ];

  for (const file of filesToCheck) {
    it(`${file} should not contain hardcoded reward business numbers`, () => {
      const literals = extractNumericLiterals(file);

      for (const lit of literals) {
        // In rewardCaps and rewards services, 50 is also forbidden (provisional manualAdjustMaxPoints)
        if (file.includes("rewardCaps") || file.includes("rewards.ts")) {
          expect(
            lit.value === 50,
            `Found hardcoded points threshold 50 in ${file} at line ${lit.line}. Reward rules must be dynamically loaded.`,
          ).toBe(false);
        }

        // Explicitly check for forbidden reward business constants
        expect(
          FORBIDDEN_BUSINESS_NUMBERS.has(lit.value),
          `Found forbidden hardcoded reward business number ${lit.value} in ${file} at line ${lit.line}. Reward rules must be dynamically loaded.`,
        ).toBe(false);

        // General allowlist validation
        const isAllowed = ALLOWED_NUMBERS.has(lit.value);
        expect(
          isAllowed,
          `Found unexpected numeric literal ${lit.value} in ${file} at line ${lit.line}. Only approved structural/time/math constants are permitted.`,
        ).toBe(true);
      }
    });
  }
});
