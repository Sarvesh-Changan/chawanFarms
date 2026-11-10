import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  if (process.env.APP_ENV !== "development" || !process.argv.includes("--i-know-this-is-dev")) {
    throw new Error("Read-only settings image diagnostics require APP_ENV=development and --i-know-this-is-dev. Do not point this script at production.");
  }

  const { db } = await import("../src/server/db");
  try {
    const keys = ["home.hero.mediaId", "home.hero.inset1MediaId", "home.hero.inset2MediaId", "owner.mediaId"];
    const rows = await db.setting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
    const values = new Map(rows.map(({ key, value }) => [key, value]));
    const ids = [...new Set(rows.flatMap(({ value }) => typeof value === "string" ? [value] : []))];
    const media = ids.length ? await db.media.findMany({ where: { id: { in: ids } }, select: { id: true, kind: true, origin: true, isPublic: true, deletedAt: true, meta: true, _count: { select: { usages: true } } } }) : [];
    const mediaById = new Map(media.map((row) => [row.id, row]));

    for (const key of keys) {
      const value = values.get(key);
      const id = typeof value === "string" ? value : null;
      const storedMedia = id ? mediaById.get(id) : undefined;
      const meta = storedMedia?.meta && typeof storedMedia.meta === "object" && !Array.isArray(storedMedia.meta) ? storedMedia.meta as Record<string, unknown> : {};
      console.log(JSON.stringify({
        key,
        settingPresent: values.has(key),
        valueShape: typeof value === "string" ? "string" : value === null || value === undefined ? "null" : Array.isArray(value) ? "array" : typeof value,
        mediaFound: Boolean(storedMedia),
        kind: storedMedia?.kind ?? null,
        origin: storedMedia?.origin ?? null,
        isPublic: storedMedia?.isPublic ?? null,
        deleted: storedMedia?.deletedAt !== null && storedMedia?.deletedAt !== undefined,
        usageCount: storedMedia?._count.usages ?? 0,
        pending: typeof meta.pending === "boolean" ? meta.pending : null,
        pendingExpiryPresent: typeof meta.pendingUntil === "string",
      }));
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error("Settings image diagnostics failed. No setting values or media identifiers were printed.");
  process.exitCode = 1;
});
