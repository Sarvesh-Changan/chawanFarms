import { z } from "zod";

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
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().email().default("onboarding@resend.dev"),
    ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO: z.string().min(1).optional(),
    CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE: z.string().min(1).optional(),
    CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO: z.string().min(1).optional(),
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .strict();

export const env = envSchema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    PREVIEW_SECRET: process.env.PREVIEW_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO: process.env.CLOUDINARY_UPLOAD_PRESET_CUSTOMER_VIDEO,
    CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE: process.env.CLOUDINARY_UPLOAD_PRESET_ADMIN_IMAGE,
    CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO: process.env.CLOUDINARY_UPLOAD_PRESET_ADMIN_VIDEO,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
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
