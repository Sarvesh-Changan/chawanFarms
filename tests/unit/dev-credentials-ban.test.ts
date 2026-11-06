/* eslint-disable security/detect-non-literal-fs-filename */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const BANNED_PATTERNS = [
  /admin123/i,
  /Admin@123/,
  /password123/i,
  /superadmin123/i,
  /admin:admin/i,
  /admin@example\.com/i,
  /superadmin@example\.com/i,
];

function getFiles(dir: string, fileList: string[] = []): string[] {
  const items = readdirSync(dir);
  for (const item of items) {
    if (
      item === "node_modules" ||
      item === ".git" ||
      item === ".next" ||
      item === "generated" ||
      item === "ui-audit" ||
      item === "archigreen"
    ) {
      continue;
    }
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      getFiles(fullPath, fileList);
    } else if (
      fullPath.endsWith(".ts") ||
      fullPath.endsWith(".tsx") ||
      fullPath.endsWith(".js") ||
      fullPath.endsWith(".mjs") ||
      fullPath.endsWith(".json") ||
      fullPath.endsWith(".md") ||
      fullPath.endsWith(".env.example")
    ) {
      // Do not scan this ban test file itself or the blocked common passwords dictionary
      if (!fullPath.includes("dev-credentials-ban.test.ts") && !fullPath.includes("common-passwords.json")) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

describe("Development credential regression guard", () => {
  it("ensures no known development admin credentials appear in seeds, scripts, docs, or source", () => {
    const rootDir = process.cwd();
    const filesToScan = [
      ...getFiles(join(rootDir, "scripts")),
      ...getFiles(join(rootDir, "prisma")),
      ...getFiles(join(rootDir, "src")),
      join(rootDir, ".env.example"),
      join(rootDir, "README.md"),
    ];

    const violations: { file: string; match: string }[] = [];

    for (const file of filesToScan) {
      try {
        const content = readFileSync(file, "utf8");
        for (const pattern of BANNED_PATTERNS) {
          const match = content.match(pattern);
          if (match) {
            violations.push({ file, match: match[0] });
          }
        }
      } catch {
        // File may not exist or cannot be read
      }
    }

    expect(
      violations,
      `Found forbidden dev credentials in codebase: ${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  it("verifies prisma/seed.ts never creates any User or Account records", () => {
    const seedContent = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");
    expect(seedContent).not.toMatch(/db\.user\.create/);
    expect(seedContent).not.toMatch(/db\.account\.create/);
    expect(seedContent).not.toMatch(/db\.user\.upsert/);
    expect(seedContent).not.toMatch(/db\.account\.upsert/);
  });
});

