import { describe, expect, it } from "vitest";

import { formatINR } from "../../src/lib/money";

describe("formatINR", () => {
  it("formats paise as Indian rupees", () => {
    expect(formatINR(140_000)).toBe("₹1,400");
  });
});
