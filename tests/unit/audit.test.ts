import { describe, expect, it } from "vitest";

import { redactSensitive } from "../../src/server/services/audit-redaction";

describe("audit redaction", () => {
  it("redacts secrets and masks email and phone PII recursively", () => {
    expect(
      redactSensitive({
        password: "not-for-logs",
        email: "asha@example.com",
        phone: "+91 9821502956",
        nested: [{ resetToken: "secret-token" }],
      }),
    ).toEqual({
      password: "[REDACTED]",
      email: "a***@example.com",
      phone: "***56",
      nested: [{ resetToken: "[REDACTED]" }],
    });
  });
});
