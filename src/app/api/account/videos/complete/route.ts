import { NextResponse } from "next/server";

import { MEDIA_API_MAX_REQUEST_BYTES } from "@/config/media";
import { getSession } from "@/server/auth";
import { completeUpload } from "@/server/services/videoSubmissions";

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
  const result = await completeUpload(session.user.id, input);
  if (!result.ok) {
    const status = result.error.code === "NOT_FOUND" ? 404 : result.error.code === "CONFLICT" ? 409 : 422;
    return NextResponse.json({ error: result.error.message, fieldErrors: result.error.fieldErrors }, { status });
  }
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
