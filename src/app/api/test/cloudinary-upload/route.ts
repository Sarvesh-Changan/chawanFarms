import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { mediaPolicy } from "@/config/media";
import { requireUser } from "@/server/auth";

export async function POST(request: Request) {
  if (!env.CLOUDINARY_TEST_MODE || env.APP_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await requireUser();
  const form = await request.formData();
  const publicId = form.get("public_id");
  const file = form.get("file");
  if (typeof publicId !== "string" || !(file instanceof File) || !publicId.startsWith(`${mediaPolicy("customer_video").folder(session.user.id)}/`)) {
    return NextResponse.json({ error: "Invalid test upload" }, { status: 400 });
  }
  return NextResponse.json({ public_id: publicId, resource_type: "video", type: "authenticated", format: "mp4", bytes: 1_000, duration: 10, etag: "cloudinary-test-asset-hash" });
}
