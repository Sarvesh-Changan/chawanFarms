"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { err, ok, type Result } from "@/lib/result";
import { policyVersionPublishSchema, policyVersionSaveSchema } from "@/lib/schemas/cms/policies";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { getPolicyVersion, publishPolicyVersion, savePolicyDraft } from "@/server/services/cms/policies";

type PreparedMutation = { actorId: string; ip: string; requestHeaders: Headers } | { error: Result<never> };

async function prepare(action: string, permission: "cms.write" | "cms.publish"): Promise<PreparedMutation> {
  const requestHeaders = await headers();
  const ip = (requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim().slice(0, 128).replace(/[^a-zA-Z0-9:._-]/g, "_") ?? "unknown";
  try {
    if (!(await limit(`cms-policy:${action}:ip:${ip}`, CMS_MUTATION_RATE_LIMIT.max, CMS_MUTATION_RATE_LIMIT.windowSeconds)).allowed) return { error: err("RATE_LIMITED", "Too many policy changes. Try again shortly.") } as const;
  } catch { return { error: err("UNAVAILABLE", "Policies are temporarily unavailable.") } as const; }
  try {
    const staff = await requirePermission(permission);
    if (!("id" in staff)) return { error: err("FORBIDDEN", "Staff permission required.") } as const;
    return { actorId: staff.id, ip, requestHeaders } as const;
  } catch (error) {
    return { error: error instanceof AuthorizationError && error.code === "UNAUTHENTICATED" ? err("UNAUTHENTICATED", "Please sign in.") : err("FORBIDDEN", "You do not have permission.") } as const;
  }
}

async function record(input: { actorId: string; ip: string; requestHeaders: Headers; action: string; before: unknown; after: { id: string } }) {
  const result = await audit({ actor: { id: input.actorId, type: "STAFF" }, action: input.action, entityType: "PolicyVersion", entityId: input.after.id, before: input.before, after: input.after, ip: input.ip, userAgent: input.requestHeaders.get("user-agent")?.slice(0, 512), requestId: input.requestHeaders.get("x-request-id")?.slice(0, 128) });
  revalidateTag("cms:policies", "max");
  for (const path of ["/policies", "/privacy", "/terms", "/admin/cms/policies"]) revalidatePath(path);
  return result;
}

export async function savePolicyDraftAction(raw: unknown): Promise<Result<{ id: string }>> {
  const started = await prepare("save", "cms.write");
  if ("error" in started) return started.error;
  const parsed = policyVersionSaveSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Please review the policy text.", parsed.error.flatten().fieldErrors);
  const before = parsed.data.id ? await getPolicyVersion(parsed.data.id) : null;
  try {
    const after = await savePolicyDraft(parsed.data);
    const logged = await record({ ...started, action: before ? "cms.policy.draft.update" : "cms.policy.version.create", before, after });
    return logged.ok ? ok({ id: after.id }) : logged;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return err(message === "POLICY_VERSION_IMMUTABLE" ? "CONFLICT" : "UNAVAILABLE", message === "POLICY_VERSION_IMMUTABLE" ? "Published policy versions are immutable. Create a new version." : "The policy draft could not be saved.");
  }
}

export async function publishPolicyVersionAction(raw: unknown): Promise<Result<{ id: string }>> {
  const started = await prepare("publish", "cms.publish");
  if ("error" in started) return started.error;
  const parsed = policyVersionPublishSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid policy version.", parsed.error.flatten().fieldErrors);
  try {
    const published = await publishPolicyVersion(parsed.data.id);
    const logged = await record({ ...started, action: "cms.policy.publish", before: published.before, after: published.after });
    return logged.ok ? ok({ id: published.after.id }) : logged;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "POLICY_PENDING_DECISION") return err("CONFLICT", "This policy remains unpublished until client decision D-2 is recorded.");
    return err("CONFLICT", "Published policy versions cannot be changed; create a new draft version.");
  }
}
