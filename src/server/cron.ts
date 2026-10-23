import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/config/env";

export function isCronRequestAuthorized(request: Request): boolean {
  const configured = env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = configured ? `Bearer ${configured}` : "";
  const actual = Buffer.from(header);
  const wanted = Buffer.from(expected);
  return Boolean(configured && actual.length === wanted.length && timingSafeEqual(actual, wanted));
}

export async function runCronJob<T>(request: Request, name: string, job: () => Promise<T>): Promise<Response> {
  if (!isCronRequestAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await job();
    console.info("[cron] completed", { job: name });
    return Response.json({ ok: true, job: name, result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[cron] failed", { job: name });
    return Response.json({ error: "Job failed" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
