import "server-only";

import { db } from "@/server/db";

export async function getCmsHeroMediaOptions() {
  const items = await db.media.findMany({
    where: { kind: "IMAGE", origin: "ADMIN", isPublic: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, publicId: true, altText: true, format: true },
  });
  return items.map((item) => ({ ...item, kind: "IMAGE" as const }));
}
