import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { publicCmsWhere } from "@/lib/cms-public-policy";
import { menuItemFormSchema } from "@/lib/schemas/cms/menu";
import { storyFormSchema, storyStatusSchema } from "@/lib/schemas/cms/stories";

const migration = readFileSync(path.join(process.cwd(), "prisma/migrations/20261028120000_stories_unify/migration.sql"), "utf8");

describe("unified stories and menu safeguards", () => {
  it("requires a story title and caps photo media at eight", () => {
    expect(storyFormSchema.safeParse({ slug: "a-story", title: { en: "" }, photoMediaIds: [] }).success).toBe(false);
    const base = { slug: "a-story", title: { en: "A story" }, photoMediaIds: Array.from({ length: 8 }, (_, index) => `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`) };
    expect(storyFormSchema.safeParse(base).success).toBe(true);
    expect(storyFormSchema.safeParse({ ...base, photoMediaIds: [...base.photoMediaIds, "99999999-0000-4000-8000-000000000000"] }).success).toBe(false);
  });

  it("accepts migrated experience identifiers when publishing a story", () => {
    expect(storyStatusSchema.safeParse({ id: "12d6880ca556715a44915f7ad6672b52", status: "PUBLISHED", publishAt: null }).success).toBe(true);
  });

  it("converts a blank menu price to null and stores rupees as paise", () => {
    const input = { categoryId: "00000000-0000-0000-0000-000000000000", name: { en: "Extra dish" }, foodPreference: "BOTH" as const, isExtraCharge: true, priceRupees: "", published: false };
    expect(menuItemFormSchema.parse(input).priceRupees).toBeNull();
    expect(menuItemFormSchema.parse({ ...input, priceRupees: "125.50" }).priceRupees).toBe(12_550);
  });

  it("requires approved consent for guest stories in the public policy", () => {
    const policy = publicCmsWhere("post", new Date());
    expect(JSON.stringify(policy)).toContain("sourceSubmission");
    expect(JSON.stringify(policy)).toContain("consentPublish");
    expect(JSON.stringify(policy)).toContain("APPROVED");
  });

  it("keeps the stories migration idempotent and non-destructive", () => {
    expect(migration).toContain("RAISE NOTICE 'stories_unify dry-run");
    expect(migration).toContain('p."sourceExperienceId" = e."id"');
    expect(migration).toContain("INSERT INTO \"MediaUsage\"");
    expect(migration).toContain("'-experience'");
    expect(migration).not.toMatch(/DROP TABLE|DELETE FROM \"Experience\"|DELETE FROM \"Media\"/i);
  });
});
