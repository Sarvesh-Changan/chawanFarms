import { describe, expect, it } from "vitest";

import { parseEnv } from "@/config/env";

const deployedEnv = {
  APP_ENV: "production",
  AUTH_SECRET: "a-secure-test-secret-that-is-long-enough",
  NEXT_PUBLIC_SITE_URL: "https://example.test",
  AUTH_TRUSTED_ORIGINS: "https://example.test",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "mailer",
  SMTP_PASS: "secret-value",
  EMAIL_FROM: "noreply@example.test",
  EMAIL_FROM_NAME: "Test",
  ADMIN_NOTIFY_EMAIL: "admin@example.test",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
  CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE: "test-preset",
  CLOUDINARY_FOLDER_MODE: "dynamic",
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "test-cloud",
};

describe("deployed Cloudinary environment", () => {
  it("accepts a complete matching Settings image configuration", () => {
    expect(parseEnv(deployedEnv).CLOUDINARY_FOLDER_MODE).toBe("dynamic");
  });

  it("fails fast when the admin image preset is absent", () => {
    const incomplete = Object.fromEntries(Object.entries(deployedEnv).filter(([key]) => key !== "CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE"));
    expect(() => parseEnv(incomplete)).toThrow(/CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE/);
  });

  it("fails fast when the public and server cloud names differ", () => {
    expect(() => parseEnv({ ...deployedEnv, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "other-cloud" })).toThrow(/must match CLOUDINARY_CLOUD_NAME/);
  });

  it("requires an explicit folder mode in deployed environments", () => {
    const incomplete = Object.fromEntries(Object.entries(deployedEnv).filter(([key]) => key !== "CLOUDINARY_FOLDER_MODE"));
    expect(() => parseEnv(incomplete)).toThrow(/CLOUDINARY_FOLDER_MODE/);
  });
});
