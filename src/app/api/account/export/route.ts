import { NextResponse } from "next/server";

import { getSession } from "@/server/auth";
import { limit } from "@/server/integrations/ratelimit";
import { getPrivacyExport } from "@/server/services/account";
import { audit } from "@/server/services/audit";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "127.0.0.1").slice(0, 128);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rate = await limit(`account:export:user:${session.user.id}`, 3, 86_400);
  if (!rate.allowed) return NextResponse.json({ error: "Export limit reached. Try again tomorrow." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } });
  const payload = await getPrivacyExport(session.user.id);
  if (!payload) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const ip = clientIp(request);
  await audit({ actor: { id: session.user.id, type: "CUSTOMER" }, action: "account.privacy.exported", entityType: "User", entityId: session.user.id, after: { generated: true }, ip, userAgent: request.headers.get("user-agent")?.slice(0, 512) });
  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="chawan-farms-account-export.json"',
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
