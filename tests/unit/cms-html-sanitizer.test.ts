import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sanitizeCmsHtml } from "@/server/cms/html";

describe("CMS rich text sanitizer", () => {
  it("removes scripts and event handlers", () => {
    const html = sanitizeCmsHtml('<p onclick="alert(1)">Hello<script>alert(1)</script><img src=x onerror="alert(2)"></p>');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).toContain("Hello");
  });

  it("rejects unsafe links and retains only allowed protocols", () => {
    const html = sanitizeCmsHtml('<a href="javascript:alert(1)">bad</a><a href="https://example.org">good</a>');
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.org"');
    expect(html).toContain("noopener noreferrer nofollow");
  });
});
