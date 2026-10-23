import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { AccountNav } from "@/components/account/AccountNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/account" }));

describe("account navigation", () => {
  it("has no basic accessibility violations on mobile and desktop navigation", async () => {
    const { container } = render(<AccountNav />);
    expect((await axe(container)).violations).toEqual([]);
    expect(container.querySelectorAll('a[href^="/account"]').length).toBeGreaterThanOrEqual(18);
  });
});
