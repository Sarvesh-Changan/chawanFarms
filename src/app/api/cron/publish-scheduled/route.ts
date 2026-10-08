import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { CMS_SCHEDULE_BATCH_SIZE } from "@/config/cms-content";
import { env } from "@/config/env";
import { audit } from "@/server/services/audit";
import { publishScheduledCms } from "@/server/services/cms/content";

export async function POST(request: NextRequest) {
  const expected = env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const count = await publishScheduledCms(new Date(), CMS_SCHEDULE_BATCH_SIZE);
    if (count > 0) {
      revalidateTag("cms:all", "max");
      revalidatePath("/activities"); revalidatePath("/experiences"); revalidatePath("/food"); revalidatePath("/faqs");
      revalidatePath("/gallery"); revalidatePath("/stories");
    }
    const result = await audit({ actor: null, action: "cms.scheduled.publish", entityType: "CMS", after: { publishedCount: count } });
    if (!result.ok) return NextResponse.json({ error: "Audit unavailable" }, { status: 503 });
    return NextResponse.json({ published: count });
  } catch { return NextResponse.json({ error: "Scheduled publishing failed" }, { status: 500 }); }
}
