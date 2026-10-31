import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_768) {
    return new NextResponse(null, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (raw) {
      const data = JSON.parse(raw) as { "csp-report"?: Record<string, unknown> };
      const report = data["csp-report"];
      if (report && process.env.NODE_ENV !== "production") {
        console.warn("[CSP-Report-Only Violation]", {
          blockedUri: report["blocked-uri"],
          violatedDirective: report["violated-directive"],
          effectiveDirective: report["effective-directive"],
          documentUri: report["document-uri"],
        });
      }
    }
  } catch {
    // Silently acknowledge malformed CSP reports
  }

  return new NextResponse(null, { status: 204 });
}
