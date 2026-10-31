import { NextResponse } from "next/server";

import { MEDIA_API_MAX_REQUEST_BYTES } from "@/config/media";
import { getSession } from "@/server/auth";
import { startUpload } from "@/server/services/videoSubmissions";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MEDIA_API_MAX_REQUEST_BYTES) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  const result = await startUpload(session.user.id, input);
  if (!result.ok) {
    const code = result.error.code;
    let status = 422;
    if (code === "UPLOAD_IN_PROGRESS" || code === "CONFLICT") {
      status = 409;
    } else if (
      code === "DAILY_LIMIT_EXCEEDED" ||
      code === "PERIOD_LIMIT_EXCEEDED" ||
      code === "PENDING_CAP_REACHED" ||
      code === "RATE_LIMITED"
    ) {
      status = 429;
    } else if (
      code === "EMAIL_NOT_VERIFIED" ||
      code === "ACCOUNT_INELIGIBLE" ||
      code === "FORBIDDEN"
    ) {
      status = 403;
    } else if (
      code === "REWARDS_DISABLED" ||
      code === "SERVICE_UNAVAILABLE" ||
      code === "UNAVAILABLE"
    ) {
      status = 503;
    } else if (code === "NOT_FOUND") {
      status = 404;
    }

    console.warn(`[startUpload rejected] code=${code}`);

    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (result.error.retryAfter !== undefined) {
      headers["Retry-After"] = String(result.error.retryAfter);
    }

    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
        error: result.error.message,
        ...(result.error.retryAfter !== undefined ? { retryAfter: result.error.retryAfter } : {}),
        ...(result.error.submissionId ? { submissionId: result.error.submissionId } : {}),
        ...(result.error.fieldErrors ? { fieldErrors: result.error.fieldErrors } : {}),
      },
      { status, headers }
    );
  }
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
