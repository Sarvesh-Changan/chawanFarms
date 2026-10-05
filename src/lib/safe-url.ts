import { z } from "zod";

const relativePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Only relative paths are allowed.",
  })
  .refine((value) => !/[\\\r\n]/.test(value), {
    message: "The callback URL is invalid.",
  });

export function safeCallbackUrl(value: unknown, fallback = "/account"): string {
  const parsed = relativePathSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  const fallbackResult = relativePathSchema.safeParse(fallback);
  if (!fallbackResult.success) return "/";
  return fallbackResult.data;
}

export function isSafeCallbackUrl(value: unknown): value is string {
  return relativePathSchema.safeParse(value).success;
}
