import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("admin and public route migrations", () => {
  it("keeps the approved permanent redirect map", async () => {
    const redirects = await nextConfig.redirects?.();
    const bySource = new Map((redirects ?? []).map((redirect) => [redirect.source, redirect]));
    for (const [source, destination] of [
      ["/offers", "/packages"],
      ["/admin/cms", "/admin"],
      ["/admin/cms/pages", "/admin"],
      ["/admin/cms/policies/:path*", "/admin/settings/policies/:path*"],
      ["/admin/cms/packages/:path*", "/admin/packages/:path*"],
      ["/admin/cms/accommodations/:path*", "/admin/accommodation/:path*"],
      ["/admin/cms/activity/:path*", "/admin/activities/:path*"],
      ["/admin/cms/experience/:path*", "/admin/experiences-legacy/:path*"],
      ["/admin/cms/menu-category/:path*", "/admin/menu/menu-category/:path*"],
      ["/admin/cms/menu-item/:path*", "/admin/menu/menu-item/:path*"],
      ["/admin/cms/faq/:path*", "/admin/faqs/:path*"],
      ["/admin/cms/gallery-item/:path*", "/admin/gallery/:path*"],
      ["/admin/cms/post/:path*", "/admin/stories/:path*"],
      ["/admin/cms/post-category/:path*", "/admin/stories"],
      ["/admin/cms/offer/:path*", "/admin"],
      ["/admin/cms/testimonial/:path*", "/admin"],
    ] as const) {
      expect(bySource.get(source)).toMatchObject({ destination, permanent: true });
    }
    expect((redirects ?? []).some((redirect) => redirect.source === "/experiences/:path*")).toBe(false);
  });
});
