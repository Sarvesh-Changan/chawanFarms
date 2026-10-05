import "server-only";

import { z } from "zod";

import { env } from "@/config/env";

const tokenSchema = z.string().trim().min(1).max(2048);
const remoteIpSchema = z.string().trim().max(128);
const responseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  cdata: z.string().optional(),
}).strict();

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: unknown,
): Promise<boolean> {
  const parsedToken = tokenSchema.safeParse(token);
  if (!parsedToken.success) {
    return env.APP_ENV === "development" && token === undefined;
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return env.APP_ENV === "development";
  }

  const parsedRemoteIp = remoteIpSchema.safeParse(remoteIp);
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: parsedToken.data,
  });
  if (parsedRemoteIp.success) body.set("remoteip", parsedRemoteIp.data);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) return false;
    const result = responseSchema.safeParse(await response.json());
    return result.success && result.data.success;
  } catch {
    return false;
  }
}
