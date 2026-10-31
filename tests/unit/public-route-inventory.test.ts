import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { publicNavFooter, publicNavGroups, publicNavHome, publicNavTopLevel } from "@/config/public-nav";

const sourceRoot = process.cwd();

function publicRouteExists(href: string): boolean {
  const route = href === "/" ? "page.tsx" : join(href.slice(1), "page.tsx");
  // The route is assembled only from the fixed public navigation configuration.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return existsSync(join(sourceRoot, "src", "app", "(public)", ...route.split("/")));
}

describe("public route inventory", () => {
  it("keeps every primary and footer navigation link backed by a public route", () => {
    const links = [
      publicNavHome,
      ...publicNavGroups.flatMap((group) => group.items),
      ...publicNavTopLevel,
      ...publicNavFooter,
    ];

    expect(links.filter((item) => !publicRouteExists(item.href))).toEqual([]);
  });

  it("does not publish removed Offers or Testimonial routes in the sitemap source", () => {
    const sitemap = readFileSync(join(sourceRoot, "src", "app", "sitemap.ts"), "utf8");

    expect(sitemap).not.toMatch(/offers|testimonial/i);
    expect(sitemap).toContain("/experiences");
  });
});
