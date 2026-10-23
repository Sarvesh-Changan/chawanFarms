import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMAIL_DAILY_LIMIT,
  EMAIL_OPTIONAL_LIMIT,
} from "@/config/email";
import { parseEnv } from "@/config/env";
import {
  InMemoryEmailTransport,
  sendBookingAcknowledgementEmail,
  sendBookingAdminAlertEmail,
  sendBookingCancelledEmail,
  sendBookingConfirmedEmail,
  sendLeadAcknowledgementEmail,
  sendLeadAdminAlertEmail,
  sendResetPasswordEmail,
  sendStaffInviteEmail,
  sendVerificationEmail,
  setEmailQuotaLimiterForTests,
  setEmailTransportForTests,
} from "@/server/integrations/email";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/chawan";
});

const baseLimiter = async () => ({ allowed: true, remaining: 399, retryAfterSeconds: 60 });

afterEach(() => {
  setEmailTransportForTests();
  setEmailQuotaLimiterForTests(baseLimiter);
  vi.restoreAllMocks();
});

describe("email integration", () => {
  it("uses the in-memory transport and renders HTML plus plain text", async () => {
    const transport = new InMemoryEmailTransport();
    setEmailTransportForTests(transport);
    setEmailQuotaLimiterForTests(baseLimiter);

    await sendVerificationEmail({
      to: "guest@example.com",
      name: "Guest",
      url: "https://example.com/verify?token=secret-token",
    });

    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({
      type: "verification",
      to: ["guest@example.com"],
      subject: "Verify your Chawan Farms email",
    });
    expect(transport.messages[0]?.html).toContain("Guest");
    expect(transport.messages[0]?.text).toContain("GUEST");
  });

  it("strips CR/LF from headers and escaped template variables", async () => {
    const transport = new InMemoryEmailTransport();
    setEmailTransportForTests(transport);
    setEmailQuotaLimiterForTests(baseLimiter);

    await sendLeadAcknowledgementEmail({
      to: "guest@example.com\r\n",
      name: "<Guest>\r\nBcc: attacker@example.com",
      reference: "REF-1\r\nX-Injected: yes",
    });

    const message = transport.messages[0];
    expect(message).toBeDefined();
    expect(message?.to).toEqual(["guest@example.com"]);
    expect(message?.subject).not.toMatch(/[\r\n]/);
    expect(message?.html).not.toContain("<Guest>");
    expect(message?.html).not.toMatch(/[\r\n]Bcc:/);
  });

  it("does not log message bodies, links or SMTP credentials", async () => {
    const transport = new InMemoryEmailTransport();
    setEmailTransportForTests(transport);
    setEmailQuotaLimiterForTests(baseLimiter);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await sendVerificationEmail({
      to: "guest@example.com",
      name: "Guest",
      url: "https://example.com/verify?token=token-that-must-not-be-logged",
    });
    await new (class extends InMemoryEmailTransport {})().send({
      type: "test",
      to: ["guest@example.com"],
      from: "Chawan Farms <guest@example.com>",
      subject: "safe",
      html: "password-that-must-not-be-logged",
      text: "token-that-must-not-be-logged",
    });

    const output = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    expect(output).not.toContain("token-that-must-not-be-logged");
    expect(output).not.toContain("password-that-must-not-be-logged");
  });

  it("fails production environment validation when SMTP settings are absent", () => {
    expect(() => parseEnv({
      APP_ENV: "production",
      AUTH_SECRET: "test-auth-secret-value-that-is-long-enough-123",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
      AUTH_TRUSTED_ORIGINS: "https://example.com",
    })).toThrow();
  });

  it("blocks optional sends once the configured quota is reached", async () => {
    const transport = new InMemoryEmailTransport();
    setEmailTransportForTests(transport);
    let requestedMax = 0;
    setEmailQuotaLimiterForTests(async (_key, max) => {
      requestedMax = max;
      return { allowed: false, remaining: 0, retryAfterSeconds: 900 };
    });

    await sendLeadAcknowledgementEmail({ to: "guest@example.com", name: "Guest", reference: "REF-1" });

    expect(requestedMax).toBe(EMAIL_OPTIONAL_LIMIT);
    expect(transport.messages).toHaveLength(0);
    expect(EMAIL_DAILY_LIMIT).toBe(400);
  });

  it("keeps every existing exported function signature callable", async () => {
    const transport = new InMemoryEmailTransport();
    setEmailTransportForTests(transport);
    setEmailQuotaLimiterForTests(baseLimiter);
    const input = {
      to: "guest@example.com",
      name: "Guest",
      reference: "REF-1",
      totalPaise: 100_00,
      checkIn: "2026-11-01",
      checkOut: "2026-11-02",
      status: "PENDING_CONFIRMATION",
    };

    await sendResetPasswordEmail({ to: input.to, name: input.name, url: "https://example.com/reset?token=x" });
    await sendStaffInviteEmail({ to: input.to, url: "https://example.com/invite?token=x" });
    await sendLeadAdminAlertEmail({ ...input, phone: "+919821502956", email: input.to, formType: "contact", message: "Hello" });
    await sendBookingAcknowledgementEmail(input);
    await sendBookingAdminAlertEmail({ ...input, phone: "+919821502956" });
    await sendBookingConfirmedEmail({ to: input.to, name: input.name, reference: input.reference, checkIn: input.checkIn, checkOut: input.checkOut });
    await sendBookingCancelledEmail({ to: input.to, name: input.name, reference: input.reference, reason: "Customer request" });

    expect(transport.messages).toHaveLength(7);
  });

  it("has no legacy provider string in application or example environment files", () => {
    const root = process.cwd();
    const files = ["package.json", ".env.example", ...walkFiles(path.join(root, "src"))];
    const forbidden = "re" + "send";
    for (const file of files) {
      // The list is deliberately recursive so new source files cannot silently add the retired provider.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      expect(readFileSync(file, "utf8").toLowerCase(), file).not.toContain(forbidden);
    }
  });
});

function walkFiles(directory: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}
