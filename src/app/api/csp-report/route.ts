import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    await request.json().catch(() => null);
  } catch {
    // Gracefully ignore unparseable CSP reports
  }
  return new NextResponse(null, { status: 204 });
}
