import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = process.cwd();

function sourceFiles(directory: string): string[] {
  // The directory is constructed from the fixed repository root and fixed source segments.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(directory)) return [];

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const publicRouteAllowlist = new Set([
  "src/app/api/auth/[...all]/route.ts",
  "src/app/api/health/route.ts",
]);

function relativeSourcePath(path: string): string {
  return relative(sourceRoot, path).split("\\").join("/");
}

describe("route and server-action authorization inventory", () => {
  it("requires every non-public API route and server action to call authz/auth", () => {
    const apiRoutes = sourceFiles(join(sourceRoot, "src", "app", "api"))
      .filter((path) => path.endsWith("route.ts"));
    const actionFiles = sourceFiles(join(sourceRoot, "src", "server", "actions"));
    const failures: string[] = [];

    for (const path of apiRoutes) {
      const relativePath = relativeSourcePath(path);
      if (publicRouteAllowlist.has(relativePath)) continue;

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const source = readFileSync(path, "utf8");
      const routeMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
      const hasExportedMethod = source.split(/\r?\n/).some((line) =>
        line.includes("export") && routeMethods.some(
          (method) => line.includes(`function ${method}`) || line.includes(`const ${method}`),
        ),
      );
      if (hasExportedMethod && !["requireUser", "requireStaff", "requirePermission", "auth"].some((token) => source.includes(token))) {
        failures.push(`${relativePath}: exported route lacks an auth/authz call`);
      }
    }

    for (const path of actionFiles) {
      const relativePath = relativeSourcePath(path);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const source = readFileSync(path, "utf8");
      const hasExportedAction = source.split(/\r?\n/).some((line) =>
        line.includes("export async function") || line.includes("export function") || line.includes("export const"),
      );
      if (hasExportedAction && !["requireUser", "requireStaff", "requirePermission"].some((token) => source.includes(token))) {
        failures.push(`${relativePath}: exported action lacks an auth/authz call`);
      }
    }

    expect(failures).toEqual([]);
  });
});
