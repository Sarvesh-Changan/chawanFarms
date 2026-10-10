"use server";

import { headers } from "next/headers";

import { normalizeLeadPhone } from "@/lib/lead-phone";
import {
  publicBookingActionSchema,
} from "@/lib/schemas/booking";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { limit } from "@/server/integrations/ratelimit";
import { verifyTurnstileToken } from "@/server/integrations/turnstile";
import { submitBookingRequest, type BookingResult } from "@/server/services/booking";

export type BookingActionResponse =
  | {
      ok: true;
      data: BookingResult;
    }
  | {
      ok: false;
      error: {
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

function extractClientIp(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = headerList.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = headerList.get("x-real-ip");
  if (real) return real.trim();
  return "127.0.0.1";
}

export async function submitBookingAction(
  rawInput: unknown,
): Promise<BookingActionResponse> {
  const headerList = await headers();
  const ip = extractClientIp(headerList);
  const userAgent = headerList.get("user-agent") ?? undefined;
  const sanitizedIp = ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 128);

  // 1. Validate input schema with Zod
  const parseResult = publicBookingActionSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        message: "Please correct the highlighted errors.",
        fieldErrors: parseResult.error.flatten().fieldErrors,
      },
    };
  }

  const input = parseResult.data;

  // 2. Anti-spam checks: Honeypot & Minimum fill time (>= 3 seconds)
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return {
      ok: false,
      error: { message: "Invalid form submission." },
    };
  }

  if (Date.now() - input.startedAt < 3000) {
    return {
      ok: false,
      error: { message: "Please take a moment to review your details before submitting." },
    };
  }

  // 3. Rate limiting via PostgreSQL limiter
  // 5/hour per IP
  const ipLimit = await limit(`booking:submit:ip:${sanitizedIp}`, 5, 3600);
  if (!ipLimit.allowed) {
    return {
      ok: false,
      error: {
        message: `Too many booking submissions from this network. Please try again in ${Math.ceil(
          ipLimit.retryAfterSeconds / 60,
        )} minutes.`,
      },
    };
  }

  // 3/hour per normalized phone
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeLeadPhone(input.contactPhone);
  } catch {
    return {
      ok: false,
      error: {
        message: "Please enter a valid phone number.",
        fieldErrors: { contactPhone: ["Please enter a valid phone number with country code."] },
      },
    };
  }

  const cleanPhone = normalizedPhone.replace(/[^a-zA-Z0-9+]/g, "").slice(0, 64);
  const phoneLimit = await limit(`booking:submit:phone:${cleanPhone}`, 3, 3600);
  if (!phoneLimit.allowed) {
    return {
      ok: false,
      error: {
        message: `Too many submissions for this phone number. Please wait before submitting again.`,
      },
    };
  }

  // 3/hour per normalized email if provided
  if (input.contactEmail) {
    const cleanEmail = input.contactEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9@._+-]/g, "_").slice(0, 128);
    const emailLimit = await limit(`booking:submit:email:${cleanEmail}`, 3, 3600);
    if (!emailLimit.allowed) {
      return {
        ok: false,
        error: {
          message: "Too many submissions for this email address. Please wait before submitting again.",
        },
      };
    }
  }

  // 4. Cloudflare Turnstile verification
  const turnstileOk = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!turnstileOk) {
    return {
      ok: false,
      error: {
        message: "Security check failed. Please refresh and try again.",
        fieldErrors: { turnstileToken: ["Security verification failed."] },
      },
    };
  }

  // 5. Server-side policy verification: policyVersionId MUST match current active policy
  const currentPolicy =
    (await db.policyVersion.findFirst({
      where: { key: "stay-rules-and-cancellation", status: "PUBLISHED" },
      orderBy: { version: "desc" },
    })) ??
    (await db.policyVersion.findFirst({
      where: { key: "stay-rules-and-cancellation" },
      orderBy: { version: "desc" },
    }));

  if (currentPolicy && input.policyVersionId && input.policyVersionId !== currentPolicy.id) {
    return {
      ok: false,
      error: {
        message: "The stay policy has been updated. Please refresh the page and review the current policy before submitting.",
      },
    };
  }

  // 6. Resolve customer session if logged in
  // This public booking submission action uses optional customer getSession rather than requireUser.
  let userId: string | null = null;
  try {
    const session = await getSession();
    userId = session?.user?.id ?? null;
  } catch {
    // Guest submission
  }

  // 7. Submit through financial booking pipeline (re-quotes on server, places hold, logs lead)
  try {
    const result = await submitBookingRequest(
      {
        ...input,
        policyVersionId: currentPolicy?.id ?? input.policyVersionId,
        couponCode: null, // Per instruction 1: coupon ignored in v1
      },
      {
        ip,
        userAgent,
        userId,
      },
    );

    return {
      ok: true,
      data: result,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to complete booking request. Please try again.";
    return {
      ok: false,
      error: { message },
    };
  }
}
