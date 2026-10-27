import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { canPublishPolicy } from "@/lib/cms-page-policy";
import type { PolicyVersionSaveInput } from "@/lib/schemas/cms/policies";
import { sanitizeLocalizedHtml } from "@/server/cms/html";
import { db } from "@/server/db";

export async function listPolicyVersions() {
  return db.policyVersion.findMany({ orderBy: { key: "asc" } });
}

export async function getPolicyVersion(id: string) {
  return db.policyVersion.findUnique({ where: { id } });
}

export async function savePolicyDraft(input: PolicyVersionSaveInput) {
  const body = sanitizeLocalizedHtml(input.body) as Prisma.InputJsonValue;
  return db.$transaction(async (tx) => {
    const existing = input.id
      ? await tx.policyVersion.findUnique({ where: { id: input.id } })
      : await tx.policyVersion.findUnique({ where: { key: input.key } });

    if (existing) {
      if (existing.key !== input.key) throw new Error("POLICY_KEY_MISMATCH");
      return tx.policyVersion.update({
        where: { id: existing.id },
        data: { title: input.title, body, status: "DRAFT", publishedAt: null },
      });
    }

    return tx.policyVersion.create({ data: {
      key: input.key,
      version: 1,
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
  return db.policyVersion.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { key: "asc" } });
}

export async function getPolicyVersionsForPublic(keys: string[]) {
  const published = await db.policyVersion.findMany({
    where: { key: { in: keys }, status: "PUBLISHED", publishedAt: { lte: new Date() } },
    orderBy: { key: "asc" },
  });
  if (published.length > 0) return published;

  return db.policyVersion.findMany({
    where: { key: { in: keys } },
    orderBy: { key: "asc" },
  });
}


