/* eslint-disable security/detect-non-literal-fs-filename */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const forbidden = String.fromCharCode(57, 56, 50, 49, 48, 56, 57, 51, 55, 53);
const roots = ["src", "prisma", "public", "emails", "scripts", "docs"];

function filesUnder(directory: string): string[] {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? filesUnder(file) : [file];
  });
}

function decodeText(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep malformed encoded text searchable. */ }
  return decoded.replace(/\\u([\da-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([\da-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

describe("removed contact number content guard", () => {
  it("does not occur in public or source content, including punctuated and escaped forms", () => {
    const root = process.cwd();
    const matches: string[] = [];
    for (const relativeRoot of roots) {
      for (const file of filesUnder(path.join(root, relativeRoot))) {
        const raw = readFileSync(file, "utf8");
        const decoded = decodeText(raw);
        const found = decoded.match(/(?<!\d)(?:91[\s().-]*)?9(?:[\s().-]*\d){9}(?!\d)/g) ?? [];
        if (found.some((phone) => phone.replace(/\D/g, "").endsWith(forbidden))) matches.push(path.relative(root, file));
      }
    }
    expect(matches).toEqual([]);
  }, 30000);
});
