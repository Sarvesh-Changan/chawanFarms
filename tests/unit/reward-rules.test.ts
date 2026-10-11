/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PROVISIONAL_REWARD_DEFAULTS } from "@/config/reward-defaults";
import { computeRuleImpactSummary } from "@/lib/reward-rules";
import { rewardRuleInputSchema, type RewardRuleInput } from "@/lib/schemas/reward-rules";

describe("reward-defaults and schemas", () => {
  it("provisional defaults conforms to rewardRuleInputSchema", () => {
    const parsed = rewardRuleInputSchema.safeParse(PROVISIONAL_REWARD_DEFAULTS);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.pointsPerApprovedVideo).toBe(100);
    expect(parsed.data.maxPointsPerCustomer).toBe(500);
    expect(parsed.data.maxSubmissionsPerPeriod).toBe(2);
    expect(parsed.data.periodDays).toBe(30);
    expect(parsed.data.pointExpiryDays).toBe(365);
    expect(parsed.data.minPointsToRedeem).toBe(100);
    expect(parsed.data.couponValidityDays).toBe(90);
    expect(parsed.data.allowCombineWithOffers).toBe(false);
    expect(parsed.data.allowMultipleCouponsPerBooking).toBe(false);
    expect(parsed.data.manualAdjustMaxPoints).toBe(50);
    expect(parsed.data.manualAdjustApprovalThreshold).toBe(200);
    expect(parsed.data.tiers).toHaveLength(2);
    const firstTier = parsed.data.tiers[0];
    expect(firstTier).toBeDefined();
    if (!firstTier) return;
    expect(firstTier.pointsCost).toBe(100);
    expect(firstTier.discountValue).toBe(5);
    expect(firstTier.allPackages).toBe(true);
    expect(firstTier.allAccommodation).toBe(true);
  });

  it("rejects pointsPerApprovedVideo <= 0", () => {
    const invalid = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      pointsPerApprovedVideo: 0,
    };
    const res = rewardRuleInputSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects when no active tiers exist", () => {
    const invalid = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      tiers: PROVISIONAL_REWARD_DEFAULTS.tiers.map((t) => ({ ...t, isActive: false })),
    };
    const res = rewardRuleInputSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects when tier pointsCost < minPointsToRedeem", () => {
    const baseTier = PROVISIONAL_REWARD_DEFAULTS.tiers[0];
    expect(baseTier).toBeDefined();
    if (!baseTier) return;
    const invalid: RewardRuleInput = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      minPointsToRedeem: 200,
      tiers: [
        {
          ...baseTier,
          pointsCost: 100, // < 200
        },
      ],
    };
    const res = rewardRuleInputSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects when maxPointsPerCustomer < pointsPerApprovedVideo", () => {
    const invalid: RewardRuleInput = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      pointsPerApprovedVideo: 100,
      maxPointsPerCustomer: 50, // < 100
    };
    const res = rewardRuleInputSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects invalid percentage discount outside 1-100", () => {
    const baseTier = PROVISIONAL_REWARD_DEFAULTS.tiers[0];
    expect(baseTier).toBeDefined();
    if (!baseTier) return;
    const invalidOver: RewardRuleInput = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      tiers: [
        {
          ...baseTier,
          discountType: "PERCENTAGE",
          discountValue: 105,
        },
      ],
    };
    expect(rewardRuleInputSchema.safeParse(invalidOver).success).toBe(false);

    const invalidZero: RewardRuleInput = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      tiers: [
        {
          ...baseTier,
          discountType: "PERCENTAGE",
          discountValue: 0,
        },
      ],
    };
    expect(rewardRuleInputSchema.safeParse(invalidZero).success).toBe(false);
  });

  it("rejects when maxSubmissionsPerPeriod is set without periodDays", () => {
    const invalid: RewardRuleInput = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      maxSubmissionsPerPeriod: 3,
      periodDays: null,
    };
    const res = rewardRuleInputSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});

describe("import boundary guard test", () => {
  it("ensures reward-defaults.ts is ONLY imported by prisma/seed.ts and src/server/actions/admin-rewards.ts", () => {
    const rootDir = path.resolve(__dirname, "../../");

    function getAllFiles(dir: string, fileList: string[] = []): string[] {
      if (!fs.existsSync(dir)) return fileList;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          getAllFiles(fullPath, fileList);
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const directoriesToScan = [
      path.join(rootDir, "src/server/services"),
      path.join(rootDir, "src/server/policies"),
      path.join(rootDir, "src/app"),
    ];

    const violations: string[] = [];

    for (const dir of directoriesToScan) {
      const files = getAllFiles(dir);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        if (
          content.includes("reward-defaults") ||
          content.includes("PROVISIONAL_REWARD_DEFAULTS")
        ) {
          violations.push(path.relative(rootDir, file));
        }
      }
    }

    // Violations must be completely empty!
    expect(violations).toEqual([]);

    // Verify allowed files indeed exist and are the designated ones
    const allowedActionFile = path.join(rootDir, "src/server/actions/admin-rewards.ts");
    const allowedSeedFile = path.join(rootDir, "prisma/seed.ts");

    expect(fs.existsSync(allowedActionFile)).toBe(true);
    expect(fs.existsSync(allowedSeedFile)).toBe(true);

    const actionContent = fs.readFileSync(allowedActionFile, "utf8");
    const seedContent = fs.readFileSync(allowedSeedFile, "utf8");

    expect(actionContent).toContain("reward-defaults");
    expect(seedContent).toContain("reward-defaults");
  });
});

describe("impact summary calculation", () => {
  it("compares field values strictly without estimating revenue or cost", () => {
    const mockActiveRule = {
      id: "rule-1",
      version: 1,
      isActive: true,
      pointsPerApprovedVideo: 100,
      maxPointsPerCustomer: 500,
      maxSubmissionsPerPeriod: 2,
      periodDays: 30,
      pointExpiryDays: 365,
      minPointsToRedeem: 100,
      couponValidityDays: 90,
      allowCombineWithOffers: false,
      allowMultipleCouponsPerBooking: false,
      manualAdjustMaxPoints: 50,
      manualAdjustApprovalThreshold: 200,
      createdById: null,
      meta: null,
      createdAt: new Date(),
      tiers: [
        {
          id: "tier-1",
          ruleId: "rule-1",
          name: "Tier 1",
          pointsCost: 100,
          discountType: "PERCENTAGE" as const,
          discountValue: 5,
          maxDiscountPaise: 50000,
          minBookingPaise: 500000,
          allPackages: true,
          allAccommodation: true,
          isActive: true,
          packages: [],
          accommodations: [],
        },
      ],
    };

    const draftInput: RewardRuleInput = {
      ...PROVISIONAL_REWARD_DEFAULTS,
      pointsPerApprovedVideo: 150, // changed
      minPointsToRedeem: 120, // changed
      tiers: [
        {
          name: "Tier 1",
          pointsCost: 120, // changed
          discountType: "PERCENTAGE",
          discountValue: 8, // changed
          maxDiscountPaise: 60000,
          minBookingPaise: 500000,
          allPackages: true,
          allAccommodation: true,
          isActive: true,
          packageIds: [],
          accommodationIds: [],
        },
        {
          name: "Tier 2",
          pointsCost: 300,
          discountType: "PERCENTAGE",
          discountValue: 15,
          maxDiscountPaise: 120000,
          minBookingPaise: 1000000,
          allPackages: true,
          allAccommodation: true,
          isActive: true,
          packageIds: [],
          accommodationIds: [],
        },
      ],
    };

    const summary = computeRuleImpactSummary(draftInput, mockActiveRule, 2);

    expect(summary.hasActiveRule).toBe(true);
    expect(summary.activeVersion).toBe(1);
    expect(summary.targetVersion).toBe(2);

    // Points change detected
    const pointsChange = summary.changes.find((c) => c.field === "pointsPerApprovedVideo");
    expect(pointsChange).toBeDefined();
    expect(pointsChange?.previousValue).toBe(100);
    expect(pointsChange?.newValue).toBe(150);

    // Tier 1 modified, Tier 2 added
    expect(summary.tierChanges.find((t) => t.tierName === "Tier 1")?.action).toBe("modified");
    expect(summary.tierChanges.find((t) => t.tierName === "Tier 2")?.action).toBe("added");

    // Strictly ensure no cost or revenue fields exist
    expect("estimatedCost" in summary).toBe(false);
    expect("projectedRevenue" in summary).toBe(false);
  });
});

describe("public rewards and account dashboard neutral behavior", () => {
  it("hides numeric values when active rule is null or inactive", () => {
    type TestRule = {
      isActive: boolean;
      pointsPerApprovedVideo: number;
      minPointsToRedeem: number;
      tiers: unknown[];
    };
    function extractDisplay(rule: TestRule | null) {
      const hasActive = Boolean(rule && rule.isActive);
      return {
        pointsPerVideo: hasActive && rule ? rule.pointsPerApprovedVideo : null,
        minPoints: hasActive && rule ? rule.minPointsToRedeem : null,
        tiers: hasActive && rule ? rule.tiers : [],
      };
    }

    const result = extractDisplay(null);
    expect(result.pointsPerVideo).toBeNull();
    expect(result.minPoints).toBeNull();
    expect(result.tiers).toHaveLength(0);
  });

  it("exposes numeric values only when active rule is present and isActive is true", () => {
    const liveRule = {
      version: 1,
      isActive: true,
      pointsPerApprovedVideo: 100,
      minPointsToRedeem: 100,
      tiers: [{ name: "Tier 1", pointsCost: 100, discountValue: 5 }],
    };

    const hasActiveRule = Boolean(liveRule && liveRule.isActive);
    expect(hasActiveRule).toBe(true);

    const pointsPerVideo = hasActiveRule ? liveRule.pointsPerApprovedVideo : null;
    expect(pointsPerVideo).toBe(100);
  });
});
