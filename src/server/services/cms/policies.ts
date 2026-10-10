import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { canPublishPolicy } from "@/lib/cms-page-policy";
import type { PolicyVersionSaveInput } from "@/lib/schemas/cms/policies";
import { sanitizeLocalizedHtml } from "@/server/cms/html";
import { db } from "@/server/db";

export async function listPolicyVersions() {
  return db.policyVersion.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] });
}

export async function getPolicyVersion(id: string) {
  return db.policyVersion.findUnique({ where: { id } });
}

export async function savePolicyDraft(input: PolicyVersionSaveInput) {
  const body = sanitizeLocalizedHtml(input.body) as Prisma.InputJsonValue;
  if (input.id) {
    const result = await db.policyVersion.updateMany({
      where: { id: input.id, status: "DRAFT" },
      data: { title: input.title, body },
    });
    if (!result.count) throw new Error("POLICY_VERSION_IMMUTABLE");
    return db.policyVersion.findUniqueOrThrow({ where: { id: input.id } });
  }
  return db.$transaction(async (tx) => {
    const latest = await tx.policyVersion.aggregate({ where: { key: input.key }, _max: { version: true } });
    return tx.policyVersion.create({ data: {
      key: input.key,
      version: (latest._max.version ?? 0) + 1,
      title: input.title,
      body,
      status: "DRAFT",
    } });
  }, { isolationLevel: "Serializable" });
}

export async function publishPolicyVersion(id: string) {
  const before = await db.policyVersion.findUnique({ where: { id } });
  if (!before || before.status !== "DRAFT") throw new Error("POLICY_VERSION_IMMUTABLE");
  const meta = before.meta && typeof before.meta === "object" && !Array.isArray(before.meta) ? before.meta as Record<string, unknown> : {};
  if (!canPublishPolicy({ key: before.key, pendingDecision: meta.pendingDecision })) throw new Error("POLICY_PENDING_DECISION");
  const result = await db.policyVersion.updateMany({ where: { id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  if (!result.count) throw new Error("POLICY_VERSION_IMMUTABLE");
  return { before, after: await db.policyVersion.findUniqueOrThrow({ where: { id } }) };
}

export async function getPublishedPolicyVersions() {
  return db.policyVersion.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: [{ key: "asc" }, { version: "desc" }] });
}

export async function getPolicyVersionsForPublic(keys: string[]) {
  const published = await db.policyVersion.findMany({
    where: { key: { in: keys }, status: "PUBLISHED", publishedAt: { lte: new Date() } },
    orderBy: [{ version: "desc" }],
  });
  if (published.length > 0) return published;

  return db.policyVersion.findMany({
    where: { key: { in: keys } },
    orderBy: [{ version: "desc" }],
  });
}


