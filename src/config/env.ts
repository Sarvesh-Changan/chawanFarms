import { z } from "zod";

const envSchema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
    APP_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .strict();

export const env = envSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
});

export type Env = z.infer<typeof envSchema>;
