import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/config/env";

export async function POST(request: Request) {
  const secret = env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag("cms:settings", "max");
  revalidateTag("cms:all", "max");
  for (const path of ["/", "/about", "/packages", "/book", "/contact"]) revalidatePath(path);
  return NextResponse.json({ revalidated: true });
}
