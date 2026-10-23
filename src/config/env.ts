import { z } from "zod";

const emailPortSchema = z.coerce.number().int().min(1).max(65_535).optional();
const emailBooleanSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === "") return undefined;
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return value;
  },
  z.boolean().optional(),
);

const envSchema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
    APP_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
    DATABASE_URL: z.string().url().optional(),
    DIRECT_URL: z.string().url().optional(),
    TEST_DATABASE_URL: z.string().url().optional(),
    AUTH_SECRET: z.string().min(32),
    PREVIEW_SECRET: z.string().min(32).optional(),
    CRON_SECRET: z.string().min(32).optional(),
    AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:3000"),
    SMTP_HOST: z.string().trim().min(1).optional(),
    SMTP_PORT: emailPortSchema,
    SMTP_SECURE: emailBooleanSchema,
    SMTP_USER: z.string().trim().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    EMAIL_FROM: z.string().email().optional(),
    EMAIL_FROM_NAME: z.string().trim().min(1).max(120).optional(),
    EMAIL_REPLY_TO: z.string().email().optional(),
    ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
    EMAIL_DAILY_LIMIT: z.coerce.number().int().positive().max(1_000_000).default(400),
    EMAIL_TRANSACTIONAL_RESERVE_PERCENT: z.coerce.number().int().min(1).max(99).default(25),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO: z.string().min(1).optional(),
    CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE: z.string().min(1).optional(),
    CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO: z.string().min(1).optional(),
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_TEST_MODE: z.enum(["0", "1"]).default("0").transform((value) => value === "1"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.APP_ENV === "production") {
      const required: Array<[keyof typeof data, unknown]> = [
        ["SMTP_HOST", data.SMTP_HOST],
        ["SMTP_PORT", data.SMTP_PORT],
        ["SMTP_USER", data.SMTP_USER],
        ["SMTP_PASS", data.SMTP_PASS],
        ["EMAIL_FROM", data.EMAIL_FROM],
        ["EMAIL_FROM_NAME", data.EMAIL_FROM_NAME],
        ["ADMIN_NOTIFY_EMAIL", data.ADMIN_NOTIFY_EMAIL],
      ];
      for (const [path, value] of required) {
        if (value === undefined || value === "") {
          context.addIssue({ code: "custom", path: [path], message: `${String(path)} is required in production.` });
        }
      }
    }

    if (data.SMTP_HOST || data.SMTP_USER || data.SMTP_PASS || data.SMTP_PORT) {
      if (data.SMTP_PORT !== undefined && data.SMTP_PORT !== 465 && data.SMTP_PORT !== 587) {
        context.addIssue({ code: "custom", path: ["SMTP_PORT"], message: "SMTP_PORT must be 465 or 587." });
      }
      if (data.SMTP_PORT === 465 && data.SMTP_SECURE !== true) {
        context.addIssue({ code: "custom", path: ["SMTP_SECURE"], message: "SMTP_SECURE must be true on port 465." });
      }
      if (data.SMTP_PORT === 587 && data.SMTP_SECURE === true) {
        context.addIssue({ code: "custom", path: ["SMTP_SECURE"], message: "SMTP_SECURE must be false on port 587; STARTTLS is required." });
      }
    }
  });

export function parseEnv(input: Record<string, unknown>) {
  return envSchema.parse(input);
}

export const env = parseEnv({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    PREVIEW_SECRET: process.env.PREVIEW_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
    EMAIL_DAILY_LIMIT: process.env.EMAIL_DAILY_LIMIT,
    EMAIL_TRANSACTIONAL_RESERVE_PERCENT: process.env.EMAIL_TRANSACTIONAL_RESERVE_PERCENT,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO: process.env.CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO,
    CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE: process.env.CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE,
    CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO: process.env.CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_TEST_MODE: process.env.CLOUDINARY_TEST_MODE,
    NODE_ENV: process.env.NODE_ENV,
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export function getDatabaseEnv(): z.infer<typeof databaseEnvSchema> {
  return databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}

export type Env = z.infer<typeof envSchema>;
